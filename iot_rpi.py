import firebase_admin
from firebase_admin import credentials, storage, firestore
import serial
import time
import uuid
import os
import threading
import numpy as np
from picamera2 import Picamera2
from PIL import Image
import RPi.GPIO as GPIO

# Try tflite-runtime first, fall back to full tensorflow
try:
    import tflite_runtime.interpreter as tflite
    Interpreter = tflite.Interpreter
except ImportError:
    import tensorflow as tf
    Interpreter = tf.lite.Interpreter

# 
# CONFIGURATION
# 
FIREBASE_CRED_PATH = "/home/munilens/Documents/serviceAccountKey.json"
FIREBASE_BUCKET    = "studio-5778862957-cf09d.firebasestorage.app"
SERIAL_PORT        = "/dev/ttyUSB0"                  # or /dev/ttyACM0
SERIAL_BAUD        = 115200
MODEL_PATH         = "/home/munilens/model/model_unquant.tflite"
LABELS_PATH        = "/home/munilens/model/labels.txt"
CONFIDENCE_THRESH  = 0.6
BUTTON_PIN         = 17
#  NEW: manual drone dispatch button pin 
DRONE_BUTTON_PIN   = 27

# 
# FIREBASE INIT
# 
print("[Firebase] Initialising ...")
cred = credentials.Certificate(FIREBASE_CRED_PATH)
firebase_admin.initialize_app(cred, {"storageBucket": FIREBASE_BUCKET})
db     = firestore.client()
bucket = storage.bucket()
print("[Firebase] Connected.")

# 
# SERIAL (ESP32)
# 
try:
    ser = serial.Serial(SERIAL_PORT, SERIAL_BAUD, timeout=1)
    print(f"[Serial] Connected to ESP32 on {SERIAL_PORT}")
except Exception as e:
    print(f"[Serial] WARNING: Could not connect to ESP32  {e}")
    ser = None

def send_esp32(command: str):
    if ser and ser.is_open:
        ser.write(f"{command}\n".encode())
        time.sleep(0.3)
        if ser.in_waiting:
            ack = ser.readline().decode().strip()
            print(f"[ESP32 ACK] {ack}")

# 
# LOAD TFLITE MODEL + LABELS
# 
print("[Model] Loading TFLite model ...")
interpreter = Interpreter(model_path=MODEL_PATH)
interpreter.allocate_tensors()

input_details  = interpreter.get_input_details()
output_details = interpreter.get_output_details()
input_shape    = input_details[0]['shape']
IMG_HEIGHT     = input_shape[1]
IMG_WIDTH      = input_shape[2]

with open(LABELS_PATH, "r") as f:
    labels = [line.strip().split(" ", 1)[1] for line in f.readlines()]

print(f"[Model] Loaded. Classes: {labels}")

# 
# ACTIVE REPORT  shared between threads
# 
active_report = {
    "id"        : None,
    "gps"       : {"lat": 0, "lng": 0},
    "importance": None,   # cached from Firestore so capture thread can gate on it
}
report_lock = threading.Lock()

# Shared state for FaultVerification web-dispatched faults (faults collection)
active_fault = {
    "id" : None,
    "gps": {"lat": 0, "lng": 0},
}
fault_lock = threading.Lock()

# 
# CLASSIFY IMAGE
# 
def classify_image(image_path: str):
    img        = Image.open(image_path).convert("RGB")
    img        = img.resize((IMG_WIDTH, IMG_HEIGHT))
    input_data = np.expand_dims(np.array(img, dtype=np.float32) / 255.0, axis=0)

    interpreter.set_tensor(input_details[0]['index'], input_data)
    interpreter.invoke()

    output_data = interpreter.get_tensor(output_details[0]['index'])[0]
    top_index   = int(np.argmax(output_data))
    confidence  = float(output_data[top_index])
    label       = labels[top_index]

    print("\n\u2500\u2500\u2500 Classification Results \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")
    for l, score in zip(labels, output_data):
        bar = "\u2588" * int(score * 30)
        print(f"  {l:<25} {score * 100:5.1f}%  {bar}")
    print("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500")
    return label, confidence


#  NEW: drone dispatch helper 
def dispatch_drone(report_id: str, manual_override: bool = False) -> None:
    """
    Write drone-dispatch fields to Firestore, then command the ESP32.
    Serial command is only sent if the Firestore write succeeds.
    """
    update_payload = {
        "status"           : "Critical - Drone Dispatched",
        "droneDispatched"  : True,
        "droneDispatchedAt": firestore.SERVER_TIMESTAMP,
    }
    if manual_override:
        update_payload["manualOverride"] = True

    try:
        db.collection("reports").document(report_id).update(update_payload)
    except Exception as exc:
        print(f"[Firestore] ERROR: Drone-dispatch update failed for {report_id}  {exc}")
        return  # do not send serial command if Firestore update failed

    send_esp32("DRONE_DISPATCH")

    if manual_override:
        print(f"[MuniLens] Manual override  drone dispatched for report {report_id}")
    else:
        print(f"[MuniLens] Drone dispatched for report {report_id}")
# 


# 
# MAIN CAPTURE + CLASSIFY + UPLOAD
# 
def capture_and_upload():
    with report_lock:
        report_id  = active_report["id"]
        importance = active_report.get("importance") or ""

    if not report_id:
        print("[Button] No active report  waiting for a citizen report first.")
        return

    print(f"\n[MuniLens] Processing report: {report_id}")
    send_esp32("SCANNING")

    # 2. Capture image
    picam      = Picamera2()
    config     = picam.create_still_configuration(main={"size": (1920, 1080)})
    picam.configure(config)
    picam.start()
    time.sleep(2)
    filename   = f"fault_{uuid.uuid4().hex}.jpg"
    local_path = f"/tmp/{filename}"
    picam.capture_file(local_path)
    picam.stop()
    picam.close()

    # 3. Classify
    fault_type, confidence = classify_image(local_path)
    if confidence < CONFIDENCE_THRESH:
        fault_type = "Unclassified"

    # 4. Upload to Firebase Storage
    blob = bucket.blob(f"fault_images/{filename}")
    blob.upload_from_filename(local_path)
    blob.make_public()
    image_url = blob.public_url
    os.remove(local_path)

    # 5. Update Firestore — always write AI label + photo, then gate drone on importance
    try:
        db.collection("reports").document(report_id).update({
            "type"       : fault_type,
            "photoUrl"   : image_url,
            "description": f"AI Analysis: {fault_type} ({round(confidence * 100, 1)}% confidence)",
            "reportedAt" : firestore.SERVER_TIMESTAMP,
        })
    except Exception as exc:
        print(f"[Firestore] ERROR: Update failed for {report_id}  {exc}")

    if importance.lower() == "critical":
        dispatch_drone(report_id, manual_override=False)
    else:
        db.collection("reports").document(report_id).update({"status": "In Progress"})
        print(f"[Firestore] Report {report_id} updated to status: In Progress")
        print("[MuniLens] Importance not critical — drone dispatch skipped.")
        send_esp32("SUCCESS")

    with report_lock:
        active_report["id"]         = None
        active_report["importance"] = None
    print("[MuniLens] Pipeline complete.\n")


# ─────────────────────────────────────────────
# FAULT PIPELINE  (FaultVerification web dispatches)
# Called automatically when the web app creates a new document in the
# 'faults' collection via the "Verify with IoT" button.
# Updates the same document with classification results + verified:True
# so the web card flips to the verified state in real time.
# ─────────────────────────────────────────────
def capture_and_upload_fault():
    with fault_lock:
        fault_id   = active_fault["id"]
        gps_coords = active_fault["gps"]

    if not fault_id:
        print("[FaultPipeline] No active fault dispatch in queue.")
        return

    print(f"\n[FaultPipeline] Processing fault dispatch: {fault_id}")
    send_esp32("SCANNING")

    # Capture
    picam  = Picamera2()
    config = picam.create_still_configuration(main={"size": (1920, 1080)})
    picam.configure(config)
    picam.start()
    time.sleep(2)
    filename   = f"fault_{uuid.uuid4().hex}.jpg"
    local_path = f"/tmp/{filename}"
    picam.capture_file(local_path)
    picam.stop()
    picam.close()

    # Classify
    fault_type, confidence = classify_image(local_path)
    if confidence < CONFIDENCE_THRESH:
        fault_type = "Unclassified"

    # Upload
    blob = bucket.blob(f"fault_images/{filename}")
    blob.upload_from_filename(local_path)
    blob.make_public()
    image_url = blob.public_url
    os.remove(local_path)

    # Update the faults document so the web card reflects the result.
    # confidence stored as 0.0-1.0 — FaultVerification multiplies by 100 for display.
    try:
        db.collection("faults").document(fault_id).update({
            "fault_type" : fault_type,
            "confidence" : round(confidence, 4),
            "image_url"  : image_url,
            "verified"   : True,
            "verified_at": firestore.SERVER_TIMESTAMP,
            "device"     : "rpi4_cam3",
        })
        print(f"[FaultPipeline] Fault {fault_id} verified — {fault_type} ({confidence * 100:.1f}%)")
    except Exception as exc:
        print(f"[FaultPipeline] ERROR: Firestore update failed for {fault_id} — {exc}")

    send_esp32("SUCCESS")

    with fault_lock:
        active_fault["id"]  = None
        active_fault["gps"] = {"lat": 0, "lng": 0}
    print("[FaultPipeline] Complete.\n")


# 
# GPIO BUTTON (existing  GPIO17)
# 
def button_pressed(channel):
    threading.Thread(target=capture_and_upload).start()


#  NEW: manual drone dispatch button (GPIO27) 
def _manual_drone_dispatch():
    """Worker: force-dispatch a drone for whatever report is currently in memory."""
    with report_lock:
        report_id = active_report["id"]

    if not report_id:
        print("[MuniLens] Manual dispatch attempted but no active report in memory.")
        return

    dispatch_drone(report_id, manual_override=True)


def drone_button_pressed(channel):
    threading.Thread(target=_manual_drone_dispatch).start()
# 


def setup_button():
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    GPIO.add_event_detect(BUTTON_PIN, GPIO.FALLING, callback=button_pressed, bouncetime=3000)
    print(f"[Button] Capture button ready on GPIO{BUTTON_PIN}.")

    #  NEW: register manual drone dispatch button 
    GPIO.setup(DRONE_BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    GPIO.add_event_detect(DRONE_BUTTON_PIN, GPIO.FALLING, callback=drone_button_pressed, bouncetime=3000)
    print(f"[Button] Drone dispatch button ready on GPIO{DRONE_BUTTON_PIN}.")
    # 


# 
# FIRESTORE LISTENER (MATCHES YOUR RULES)
# 
def on_new_report(col_snapshot, changes, read_time):
    for change in changes:
        if change.type.name == "ADDED":
            doc = change.document.to_dict()
            # Only queue if the status is 'Open'
            if doc.get("status") == "Open":
                report_id = change.document.id
                with report_lock:
                    active_report["id"]         = report_id
                    active_report["importance"] = doc.get("importance")
                print(f"\n[Listener] New 'Open' report queued: {report_id}  (importance={doc.get('importance', 'unset')})")
                send_esp32("SCANNING")

def start_firestore_listener():
    col_ref   = db.collection("reports").where("status", "==", "Open")
    col_watch = col_ref.on_snapshot(on_new_report)
    print("[Listener] Watching 'reports' collection for new entries...")
    return col_watch


# ─────────────────────────────────────────────
# FAULT COLLECTION LISTENER
# Watches 'faults' where verified==False.
# The initial snapshot (existing unverified faults) is skipped so the Pi
# never auto-fires for stale docs — only truly new web-dispatched docs
# (created when admin clicks "Verify with IoT") trigger capture.
# ─────────────────────────────────────────────
_faults_initial_load_done = False

def on_fault_dispatch(col_snapshot, changes, read_time):
    global _faults_initial_load_done

    if not _faults_initial_load_done:
        # First callback is the initial snapshot — just note how many are pending
        _faults_initial_load_done = True
        print(f"[FaultListener] Ready — {len(col_snapshot)} pre-existing unverified faults (ignored).")
        return

    for change in changes:
        if change.type.name != "ADDED":
            continue

        fdoc     = change.document.to_dict()
        fault_id = change.document.id
        gps      = fdoc.get("gps", {"lat": 0, "lng": 0})

        print(f"\n[FaultListener] Web dispatch received: {fault_id}")
        print(f"[FaultListener] GPS={gps}  severity={fdoc.get('severity', '?')}")

        with fault_lock:
            active_fault["id"]  = fault_id
            active_fault["gps"] = gps

        # Auto-trigger the full capture → classify → upload pipeline
        threading.Thread(target=capture_and_upload_fault, daemon=True).start()


def start_fault_listener():
    col_ref   = db.collection("faults").where(
        filter=firestore.FieldFilter("verified", "==", False)
    )
    col_watch = col_ref.on_snapshot(on_fault_dispatch)
    print("[FaultListener] Watching 'faults' collection for web dispatches...")
    return col_watch


# ─────────────────────────────────────────────
# REMOTE CAMERA TRIGGER (piCommands listener)
# Admin presses "Trigger Pi Camera" in the web app → writes a piCommands
# document → this listener fires → loads the target report into
# active_report and starts capture_and_upload() in a new thread.
# ─────────────────────────────────────────────
def on_pi_command(col_snapshot, changes, read_time):
    for change in changes:
        if change.type.name != "ADDED":
            continue

        cmd     = change.document.to_dict()
        cmd_id  = change.document.id

        # Ignore already-processed commands (e.g. replayed on reconnect)
        if cmd.get("processed"):
            continue

        if cmd.get("type") == "CAPTURE":
            report_id = cmd.get("reportId")
            print(f"\n[piCommand] Remote camera trigger received for report: {report_id}")

            if report_id:
                # Fetch the report doc to get importance and populate active_report
                try:
                    report_doc = db.collection("reports").document(report_id).get()
                    if report_doc.exists:
                        data = report_doc.to_dict()
                        with report_lock:
                            active_report["id"]         = report_id
                            active_report["importance"] = data.get("importance")
                        print(f"[piCommand] Report loaded — importance={data.get('importance', 'unset')}")
                    else:
                        print(f"[piCommand] WARNING: Report {report_id} not found in Firestore.")
                except Exception as exc:
                    print(f"[piCommand] ERROR fetching report {report_id}: {exc}")

                # Fire capture in a thread so the listener callback returns quickly
                threading.Thread(target=capture_and_upload).start()
            else:
                print("[piCommand] WARNING: CAPTURE command missing reportId field.")

            # Mark command as processed so it is not re-triggered on reconnect
            try:
                db.collection("piCommands").document(cmd_id).update({"processed": True})
            except Exception as exc:
                print(f"[piCommand] ERROR marking command {cmd_id} processed: {exc}")


def start_pi_command_listener():
    cmd_ref   = db.collection("piCommands").where("processed", "==", False)
    cmd_watch = cmd_ref.on_snapshot(on_pi_command)
    print("[piCommand] Watching 'piCommands' collection for remote triggers...")
    return cmd_watch


# 
# SHUTDOWN
# 
def shutdown():
    send_esp32("IDLE")
    GPIO.cleanup()
    if ser and ser.is_open:
        ser.close()


if __name__ == "__main__":
    try:
        setup_button()
        watcher       = start_firestore_listener()
        cmd_watcher   = start_pi_command_listener()
        fault_watcher = start_fault_listener()
        threading.Event().wait()
    except KeyboardInterrupt:
        print("\n[MuniLens] Interrupted.")
    finally:
        shutdown()
