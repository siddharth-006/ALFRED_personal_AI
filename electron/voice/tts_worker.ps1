# ALFRED Windows SAPI Text-to-Speech Worker (Phase 5.4C)
# Runs as an isolated background child process communicating via stdin/stdout.
# Text is passed in Base64 encoding over stdin to completely prevent shell interpolation or injection.

$ErrorActionPreference = "Stop"

$csharpCode = @"
using System;
using System.IO;
using System.Text;
using System.Speech.Synthesis;
using System.Collections.Generic;

public class AlfredTtsWorker {
    private SpeechSynthesizer synth;
    private object lockObj = new object();
    private string currentId = "";

    public void Run() {
        Console.OutputEncoding = Encoding.UTF8;
        synth = new SpeechSynthesizer();

        synth.SpeakCompleted += (s, e) => {
            lock (lockObj) {
                string id = currentId;
                currentId = "";
                bool cancelled = e.Cancelled;
                Console.WriteLine("{\"event\":\"completed\",\"id\":\"" + id + "\",\"cancelled\":" + (cancelled ? "true" : "false") + "}");
            }
        };

        var voices = new List<string>();
        try {
            foreach (var v in synth.GetInstalledVoices()) {
                if (v.Enabled) {
                    voices.Add(v.VoiceInfo.Name);
                }
            }
        } catch {}

        string curVoice = (synth.Voice != null) ? synth.Voice.Name : "";
        string voicesJson = "[\"" + string.Join("\",\"", voices.ToArray()) + "\"]";
        Console.WriteLine("{\"event\":\"ready\",\"voice\":\"" + curVoice + "\",\"voices\":" + voicesJson + "}");

        string line;
        while ((line = Console.ReadLine()) != null) {
            line = line.Trim();
            if (string.IsNullOrEmpty(line)) continue;

            try {
                if (line.StartsWith("SPEAK ")) {
                    // Protocol: SPEAK <id> <base64EncodedUtf8Text>
                    int firstSpace = line.IndexOf(' ');
                    int secondSpace = line.IndexOf(' ', firstSpace + 1);
                    if (secondSpace > firstSpace) {
                        string id = line.Substring(firstSpace + 1, secondSpace - firstSpace - 1);
                        string b64 = line.Substring(secondSpace + 1);
                        byte[] bytes = Convert.FromBase64String(b64);
                        string text = Encoding.UTF8.GetString(bytes);

                        lock (lockObj) {
                            currentId = id;
                            synth.SpeakAsyncCancelAll();
                            synth.SpeakAsync(text);
                            Console.WriteLine("{\"event\":\"started\",\"id\":\"" + id + "\"}");
                        }
                    }
                } else if (line == "STOP") {
                    lock (lockObj) {
                        synth.SpeakAsyncCancelAll();
                        currentId = "";
                        Console.WriteLine("{\"event\":\"stopped\"}");
                    }
                } else if (line.StartsWith("SET_RATE ")) {
                    int rate = int.Parse(line.Substring(9));
                    synth.Rate = Math.Max(-10, Math.Min(10, rate));
                } else if (line.StartsWith("SET_VOLUME ")) {
                    int vol = int.Parse(line.Substring(11));
                    synth.Volume = Math.Max(0, Math.Min(100, vol));
                } else if (line.StartsWith("SET_VOICE ")) {
                    string voiceName = line.Substring(10);
                    try {
                        synth.SelectVoice(voiceName);
                    } catch (Exception ex) {
                        Console.WriteLine("{\"event\":\"error\",\"error\":\"Voice not found: " + ex.Message.Replace("\"", "\\\"") + "\"}");
                    }
                } else if (line == "STATUS") {
                    lock (lockObj) {
                        string state = synth.State.ToString();
                        bool speaking = (synth.State == SynthesizerState.Speaking);
                        Console.WriteLine("{\"event\":\"status\",\"state\":\"" + state + "\",\"speaking\":" + (speaking ? "true" : "false") + ",\"voice\":\"" + synth.Voice.Name + "\"}");
                    }
                } else if (line == "EXIT") {
                    lock (lockObj) {
                        synth.SpeakAsyncCancelAll();
                        break;
                    }
                }
            } catch (Exception ex) {
                Console.WriteLine("{\"event\":\"error\",\"error\":\"" + ex.Message.Replace("\"", "\\\"") + "\"}");
            }
        }

        try {
            synth.Dispose();
        } catch {}
    }
}
"@

Add-Type -TypeDefinition $csharpCode -ReferencedAssemblies "System.Speech"
$worker = New-Object AlfredTtsWorker
$worker.Run()
