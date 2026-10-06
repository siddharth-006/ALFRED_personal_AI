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

    # Notify ready
    try:
        from faster_whisper import WhisperModel
        
        device = "cpu"
        compute_type = "int8"
        try:
            import torch
            if torch.cuda.is_available():
                device = "cuda"
                compute_type = "float16"
        except Exception:
            pass

        model = WhisperModel("base.en", device=device, compute_type=compute_type)
        
        send_protocol({
            "type": "ready",
            "status": "READY",
            "model": "base.en",
            "device": device,
            "compute_type": compute_type
        })

    except Exception as e:
        send_protocol({
            "type": "ready",
            "status": "ERROR",
            "error": str(e),
            "traceback": traceback.format_exc()
        })
        return

    # Command loop
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            line = line.strip()
            if not line:
                continue

            req_id = None
            msg = json.loads(line)
            req_id = msg.get("id")
            msg_type = msg.get("type")

            if msg_type == "ping":
                send_protocol({"type": "pong", "id": req_id})

            elif msg_type == "status":
                send_protocol({
                    "type": "status",
                    "id": req_id,
                    "status": "READY",
                    "model": "base.en",
                    "device": device
                })

            elif msg_type == "transcribe":
                file_path = msg.get("filePath")
                if not file_path or not os.path.exists(file_path):
                    send_protocol({
                        "type": "transcribe_result",
                        "id": req_id,
                        "success": False,
                        "error": f"Audio file not found: {file_path}"
                    })
                    continue

                # Check if file has data
                if os.path.getsize(file_path) < 50:
                    send_protocol({
                        "type": "transcribe_result",
                        "id": req_id,
                        "success": True,
                        "transcript": "",
                        "duration": 0.0
                    })
                    continue

                # Transcribe with faster-whisper
                segments, info = model.transcribe(
                    file_path,
                    language="en",
                    beam_size=1,
                    temperature=0.0,
                    condition_on_previous_text=False
                )
                
                parts = []
                for seg in segments:
                    text = seg.text.strip()
                    if text:
                        parts.append(text)
                
                full_text = " ".join(parts).strip()
                
                send_protocol({
                    "type": "transcribe_result",
                    "id": req_id,
                    "success": True,
                    "transcript": full_text,
                    "duration": getattr(info, "duration", 0.0)
                })

            elif msg_type == "exit":
                break

        except Exception as e:
            send_protocol({
                "type": "transcribe_result",
                "id": req_id if 'req_id' in locals() else None,
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc()
            })

if __name__ == "__main__":
    main()
