# MuniLens — System Methodology

## 1. Introduction

MuniLens addresses the problem of reactive, slow, and paper-based municipal infrastructure fault management in South African municipalities. The solution replaces manual inspection cycles with a continuous, automated pipeline: citizens submit geo-tagged photo reports via a Progressive Web App; a Raspberry Pi edge node performs on-device AI classification and physical verification; cloud services aggregate data in real time; and an admin dashboard with 3D geospatial visualisation provides decision support and automated escalation.

This document describes the technical methodology underpinning each phase of that pipeline — how the solution was architected, how AI models were selected and trained, how hardware components were chosen and integrated, and how the system behaves end-to-end.

---

## 2. Solution Architecture Methodology

### 2.1 Design Principles

The architecture was designed around four guiding principles:

| Principle | Rationale |
|---|---|
| **Edge-first inference** | Municipal networks can be unreliable. Moving AI classification to the Pi eliminates cloud round-trips during verification and guarantees consistent latency regardless of connectivity. |
| **Event-driven communication** | Rather than polling, all system components communicate via Firestore `onSnapshot` listeners. This reduces bandwidth, removes unnecessary read operations, and ensures the UI and edge device react to state changes within milliseconds of them occurring. |
| **Single source of truth** | Firestore is the only persistent store. The web app, the Pi, and the ESP32 command layer all read from and write to the same documents. There is no separate API server or message queue. |
| **Role-separated security** | Citizens, admins, and the Pi operate under distinct permission boundaries enforced by Firestore Security Rules. The Pi uses a service account that bypasses client-facing rules, while web clients are restricted to their respective roles. |

### 2.2 Architectural Pattern

The system follows a **tiered IoT pipeline** pattern:

```
Citizen Device  →  Firebase Cloud  →  Raspberry Pi Edge  →  ESP32 Hardware
     (PWA)            (Firestore)         (Python agent)        (Serial UART)
```

This is distinct from a traditional client-server architecture. There is no backend API server. The Raspberry Pi acts as a **Firebase-connected edge agent**: it subscribes to Firestore change events directly using the Admin SDK, acts on them locally, and writes results back to Firestore. The web frontend does the same using the JavaScript SDK. Both sides share the same data model.

### 2.3 Concurrency Model

The Pi runs three independent Firestore watchers simultaneously using Python `threading`:

| Watcher | Collection Watched | Action on Event |
|---|---|---|
| `start_firestore_listener` | `reports` where `status == "Open"` | Caches the latest citizen report into `active_report`; arms GPIO capture button |
| `start_pi_command_listener` | `piCommands` where `processed == false` | Admin-issued remote camera trigger; fetches report, starts capture pipeline |
| `start_fault_listener` | `faults` where `verified == false` | FaultVerification web dispatch; starts fault-specific capture pipeline |

Each watcher's callback launches its pipeline in a daemon thread, ensuring the listener event loop never blocks. Thread-safety for shared state (`active_report`, `active_fault`) is enforced with `threading.Lock`.

### 2.4 Dual Classification Channels

The system implements two independent classification paths for different use cases:

- **Browser classification (TF.js)**: Runs immediately when a citizen uploads a photo during report submission. Uses the TensorFlow.js runtime in the browser to provide instant feedback and populate the `importance` field before the report reaches Firestore. This results in a better citizen UX and pre-classifies reports before any admin or IoT action.

- **Edge classification (TFLite on Pi)**: Runs on the Raspberry Pi when a physical verification is triggered. Captures a fresh image at the site using the Camera Module 3, not the citizen's phone photo. This provides a trusted, hardware-controlled verification that cannot be spoofed by a submitted image.

The two channels share the same underlying model architecture but are serialised differently — the browser uses the full `model.json` + weights format, while the Pi uses the quantisation-stripped `model_unquant.tflite`.

---

## 3. AI Model Selection and Training Methodology

### 3.1 Model Selection Rationale

**Google Teachable Machine** was selected as the training platform for the visual classification model. The decision was based on:

| Criterion | Justification |
|---|---|
| **No labelled dataset required** | Teachable Machine supports training from small, custom image collections captured specifically for SA municipal infrastructure categories. |
| **Dual export** | Produces both a TF.js web model and a TFLite edge model from a single training run, satisfying both deployment targets without re-training. |
| **Resource constraints** | The unquantised TFLite model (`model_unquant.tflite`) runs inference on a Raspberry Pi 4 in under 200 ms without requiring a GPU or hardware accelerator. |
| **Transfer learning base** | Teachable Machine uses MobileNet as a frozen feature extractor and trains only a small classification head. This means good generalisation is achieved with a much smaller per-class image count than training from scratch. |

**Google Gemini (`gemini-3-flash-preview`)** was selected for the weekly AI report generation because:
- It accepts structured JSON schema output natively via `responseMimeType: "application/json"`, eliminating post-processing fragility.
- The `flash` variant balances response speed and cost for periodic (not real-time) report generation.
- Its instruction-following capability is sufficient to generate multilingual output in South Africa's four supported languages without separate model instances.

### 3.2 Classification Task Definition

The model is trained to classify visual infrastructure faults into five categories:

| Class | Importance Mapping | Drone Dispatch |
|---|---|---|
| Water Leak | High | No |
| Pothole | Medium | No |
| Pothole with Water | High | No |
| Electric Infrastructure Damage | **Critical** | **Yes** |
| Road Cracks | Medium | No |

The importance mapping is implemented as a deterministic rule layer applied after model inference. Only `Electric Infrastructure Damage` triggers the Critical path and drone dispatch, as electrical faults carry the highest public safety risk.

### 3.3 Preprocessing Pipeline

Both inference paths apply the same preprocessing to ensure consistent results:

**Browser (TF.js):**
```
Raw image → resize(224×224) → normalize([-1, 1]) → add batch dim → inference
```
The normalization range `[-1, 1]` is used because the Teachable Machine TF.js export uses a MobileNet v2 backbone that expects this input range.

**Edge (TFLite on Pi):**
```
PIL image → convert("RGB") → resize(IMG_H × IMG_W) → np.float32 / 255.0 → expand_dims → inference
```
The TFLite path normalises to `[0, 1]` to match the unquantised `.tflite` export convention. Both produce equivalent predictions because the classification head weights are trained on the same normalised input. The input dimensions `IMG_HEIGHT` and `IMG_WIDTH` are read dynamically from the model's `input_details` tensor shape, ensuring compatibility if the model is retrained at a different resolution.

### 3.4 Confidence Gating

A fixed confidence threshold of **0.60** is applied on both inference paths. Results below this threshold fall back to `"Unclassified"` (TFLite) or are treated conservatively (TF.js). This prevents the system from acting on ambiguous predictions. The threshold was chosen to minimise false Critical classifications (which trigger drone dispatch) while still capturing genuine faults at realistic real-world image quality.

### 3.5 Gemini Report Generation Methodology

The weekly report prompt is structured as a **constrained generation** task:

1. **Structured context**: The prompt injects live Firestore statistics — total faults, resolution rate, status breakdown, importance breakdown, fault type distribution, geographic centroid, and a 25-report sample.
2. **Strict JSON schema**: The response schema enforces field types, enum constraints, and required fields using the Gemini `Type` API. This eliminates hallucinated keys or missing fields.
3. **Language injection**: The target language is injected into the prompt instruction (`"You MUST write ALL text fields entirely in ${langName}"`), enabling multilingual output without separate model calls.
4. **Operational framing**: The model is instructed to reference actual numbers from the injected statistics, preventing generic outputs.

---

## 4. Hardware Selection Rationale

### 4.1 Raspberry Pi 4 Model B

| Requirement | Why RPi 4 |
|---|---|
| **TFLite inference** | The quad-core Cortex-A72 CPU runs MobileNet-based TFLite models at acceptable latency (< 200 ms) without a dedicated NPU. |
| **Picamera2 support** | The official `Picamera2` Python library provides a stable, well-documented interface to the Camera Module 3 with full ISP support. |
| **GPIO control** | 40-pin GPIO header supports button inputs with hardware pull-up resistors and interrupt-driven edge detection via `RPi.GPIO`, eliminating the need for polling loops. |
| **USB serial** | Native USB ports provide a reliable UART interface to the ESP32 with no additional hardware required. |
| **Firebase Admin SDK** | Runs CPython 3.x, which supports the full `firebase-admin` SDK with gRPC-backed Firestore listeners — not available on microcontrollers. |

### 4.2 Camera Module 3

| Requirement | Why Camera Module 3 |
|---|---|
| **Image quality** | 12MP Sony IMX708 sensor with autofocus and HDR. 1920×1080 stills provide sufficient resolution for MobileNet input after downscaling. |
| **CSI interface** | Directly connected to the Pi's CSI-2 port — no USB bandwidth competition, deterministic latency. |
| **Picamera2 compatibility** | Fully supported by the `libcamera` stack that `Picamera2` wraps, with still configuration API (`create_still_configuration`) for reliable one-shot capture. |
| **Warm-up behaviour** | The 2-second warm-up delay (`time.sleep(2)`) after `picam.start()` allows the ISP's auto-exposure and auto-white-balance to converge, producing consistent images for classification. |

### 4.3 ESP32 Microcontroller

| Requirement | Why ESP32 |
|---|---|
| **Actuator interface** | The ESP32 controls physical actuators (LEDs, drone dispatch relay) that require fast, deterministic GPIO toggling — more suitable than the Pi for hard real-time control. |
| **Serial decoupling** | Commands (`SCANNING`, `SUCCESS`, `DRONE_DISPATCH`, `IDLE`) are sent as ASCII strings over UART at 115200 baud. This decouples the Pi's software pipeline from hardware timing completely. |
| **Fault tolerance** | The Pi checks whether the serial port is open before each write (`if ser and ser.is_open`), and Firestore updates are gated: if a Firestore write fails, the serial command is not sent. This prevents physical actuation from diverging from the cloud state. |

### 4.4 GPIO Button Design

Two GPIO inputs are registered:

| Pin | Function | Debounce | Mechanism |
|---|---|---|---|
| GPIO 17 | Capture trigger | 3000 ms | `GPIO.FALLING` edge detect, hardware `PUD_UP` pull-up |
| GPIO 27 | Manual drone dispatch | 3000 ms | `GPIO.FALLING` edge detect, hardware `PUD_UP` pull-up |

The 3-second debounce window prevents double-triggering on a single button press. Both buttons launch their pipelines in separate daemon threads so the GPIO interrupt callback returns immediately.

---

## 5. Integration Approach

### 5.1 Firestore as Integration Bus

Rather than building a dedicated message broker (MQTT, Redis, etc.), Firestore's `onSnapshot` real-time listeners serve as the integration bus between all system components. This was a deliberate architectural choice to minimise infrastructure complexity:

- No additional services to deploy or maintain
- Built-in offline persistence and automatic reconnection
- Security rules enforce access control at the data layer, not at a separate API gateway
- All events are durable — if the Pi is offline when a `piCommands` document is written, it will receive the event on reconnection and process it (protected by the `processed` flag)

### 5.2 Processed-Flag Idempotency

Both the `piCommands` listener and the `faults` listener use guard conditions to prevent duplicate execution:

- `piCommands`: each document has `processed: false` on creation. The Pi marks it `processed: true` after acting. The listener explicitly skips documents where `processed == true`.
- `faults`: on Pi startup, the first `onSnapshot` callback for the `faults` listener is the initial snapshot of all pre-existing unverified documents. A module-level `_faults_initial_load_done` flag discards this initial batch so the Pi only reacts to genuinely new web-dispatched documents.

### 5.3 Web-to-Edge Command Patterns

Two distinct command patterns are used, each suited to a different trigger context:

**Pattern A — piCommands (admin-to-Pi, report-targeted):**
The admin selects a specific existing report in the Dashboard modal and clicks "Trigger Pi Camera". The web app writes a typed command document containing the `reportId`. The Pi fetches the report from Firestore to populate `active_report`, then runs `capture_and_upload()` which updates the `reports` collection.

**Pattern B — faults (admin-to-Pi, fault verification):**
The admin views the FaultVerification page and clicks "Verify with IoT" on a high-severity unverified fault. The web app creates a new `faults` document with `verified: false`. The Pi's `start_fault_listener` treats any newly added `faults` document as an implicit command. The Pi runs `capture_and_upload_fault()` which updates that same `faults` document with results. The web card updates in real time via its own `onSnapshot` listener on the specific document.

### 5.4 Storage Integration

Images follow a write-once pattern:
1. Pi captures to `/tmp/fault_<uuid>.jpg`
2. Uploaded to Firebase Storage at `fault_images/fault_<uuid>.jpg`
3. Blob is made public, and the resulting URL is written to Firestore
4. The local `/tmp` copy is deleted
5. The web UI reads the URL from Firestore and renders the image directly from Storage

UUIDs ensure there are no filename collisions across concurrent pipeline executions.

### 5.5 Security Boundary Summary

| Actor | Auth Method | Firestore Access |
|---|---|---|
| Citizen (web) | Firebase Auth UID | Create own reports; read all reports; read/update own user profile |
| Admin (web) | Firebase Auth UID + role == "admin" | Full CRUD on reports, users; create/read/delete piCommands; create/read/delete faults |
| Raspberry Pi | Service Account (JSON key) | Bypasses Security Rules — full read/write access to all collections |
| ESP32 | No Firebase access | Receives only serial commands from Pi |

### 5.6 Multilingual Support

Four languages (English, Afrikaans, IsiXhosa, IsiZulu) are supported across the web application using a custom `useLanguage` React context backed by a static translation map. All UI strings are looked up via a `t('key')` function. The Gemini report generator also accepts a `language` parameter and injects the target language name directly into the prompt, producing AI-generated content in the correct language without separate model configurations or post-translation steps.

---

## 6. Summary

MuniLens combines edge IoT inference, Firebase real-time data synchronisation, TF.js browser classification, and Gemini-powered analytics into a single coherent pipeline. The methodology prioritises:

- **Offline resilience** through edge inference and Firestore's local cache persistence
- **Event-driven simplicity** by using Firestore as both database and message bus
- **Dual AI channels** to provide instant browser feedback to citizens and trusted hardware verification at the site
- **Minimal infrastructure** — no backend server, no message broker, no separate ML inference endpoint
- **Security by design** — role separation enforced at the data layer, not at the application layer
