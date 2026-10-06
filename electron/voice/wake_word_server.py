import sys
import os
import json
import traceback

def main():
    # Force utf-8 for stdin/stdout
    sys.stdin.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')
    
    # Save original stdout for pure JSON protocol
    real_stdout = sys.stdout
    # Redirect default sys.stdout to sys.stderr so any library banners/warnings never pollute our protocol
    sys.stdout = sys.stderr

    def send_protocol(data):
        msg = json.dumps(data, ensure_ascii=False) + "\n"
        real_stdout.write(msg)
        real_stdout.flush()

    # Load openwakeword
    wake_model = None
    phrase = "Hey Alfred"
    try:
        import types
        tf_mod = types.ModuleType('tflite_runtime')
        from tensorflow import lite as tf_lite
        tf_mod.interpreter = tf_lite
        sys.modules['tflite_runtime'] = tf_mod
        sys.modules['tflite_runtime.interpreter'] = tf_lite
        
        import openwakeword
        from openwakeword.model import Model
        import numpy as np

        model_dir = os.path.dirname(os.path.abspath(__file__))
        tflite_path = os.path.join(model_dir, "hey_alfred.tflite")

        if os.path.exists(tflite_path):
            wake_model = Model(wakeword_models=[tflite_path], inference_framework="tflite")
            active_model_name = "hey_alfred"
        else:
            # Fallback to hey_jarvis onnx model if custom model is missing
            wake_model = Model(wakeword_models=["hey_jarvis"], inference_framework="onnx")
            active_model_name = "hey_jarvis"
            phrase = "Hey Jarvis"

        send_protocol({
            "type": "ready",
            "status": "READY",
            "engine": "openwakeword",
            "model": active_model_name,
            "phrase": phrase
        })

    except Exception as e:
        send_protocol({
            "type": "ready",
            "status": "ERROR",
            "engine": "openwakeword",
            "error": str(e),
            "traceback": traceback.format_exc()
        })
        return

    # Frame processing loop
    # Audio chunks received as base64 or raw int16 binary
    import base64

    # Command loop
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            line = line.strip()
            if not line:
                continue

            msg = json.loads(line)
            req_id = msg.get("id")
            msg_type = msg.get("type")

            if msg_type == "ping":
                send_protocol({"type": "pong", "id": req_id})

            elif msg_type == "status":
                send_protocol({
                    "type": "status",
                    "id": req_id,
                    "status": "READY" if wake_model is not None else "ERROR",
                    "phrase": phrase
                })

            elif msg_type == "set_phrase":
                # Configurable wake phrase support
                new_phrase = msg.get("phrase", "Hey Alfred")
                phrase = new_phrase
                send_protocol({
                    "type": "set_phrase_result",
                    "id": req_id,
                    "success": True,
                    "phrase": phrase
                })

            elif msg_type == "reset":
                if wake_model:
                    wake_model.reset()
                send_protocol({"type": "reset_result", "id": req_id, "success": True})

            elif msg_type == "predict":
                # Expects 'audio' as base64-encoded int16 PCM (16kHz, mono)
                raw_b64 = msg.get("audio")
                threshold = float(msg.get("threshold", 0.5))

                if not raw_b64:
                    send_protocol({
                        "type": "predict_result",
                        "id": req_id,
                        "detected": False,
                        "scores": {}
                    })
                    continue

                raw_bytes = base64.b64decode(raw_b64)
                # Convert raw bytes to int16 numpy array
                audio_frame = np.frombuffer(raw_bytes, dtype=np.int16)

                # Predict
                predictions = wake_model.predict(audio_frame)

                detected = False
                detected_model = None
                max_score = 0.0

                for m_name, score in predictions.items():
                    score_val = float(score)
                    if score_val > max_score:
                        max_score = score_val
                    if score_val >= threshold:
                        detected = True
                        detected_model = m_name

                if detected:
                    wake_model.reset()

                send_protocol({
                    "type": "predict_result",
                    "id": req_id,
                    "detected": detected,
                    "score": max_score,
                    "model": detected_model,
                    "phrase": phrase
                })

            elif msg_type == "exit":
                break

        except Exception as e:
            send_protocol({
                "type": "error",
                "id": req_id if 'req_id' in locals() else None,
                "error": str(e),
                "traceback": traceback.format_exc()
            })

if __name__ == "__main__":
    main()
