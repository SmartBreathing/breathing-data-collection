let audioContext;
let micStream;
let processors = {};
let audioBuffers = {};
let audios = {};
let isPlaying = {};
let sampleRates = {};

const sessionIds = [
  'tech1-s1', 'tech1-s2', 'tech1-s3',
  'tech2-s1', 'tech2-s2', 'tech2-s3',
  'tech3-s1', 'tech3-s2', 'tech3-s3'
];

const techniques = {
  tech1: "3-3-3-3 breathing ",
  tech2: "4-2-4 breathing",
  tech3: "5-5 breathing"
};
const recordedAt = {};


function getOrCreateRandomSuffix() {
  let suffix = localStorage.getItem("participantSuffix");
  if (!suffix) {
    suffix = Math.random().toString(36).substring(2, 7); // 5 символов
    localStorage.setItem("participantSuffix", suffix);
  }
  return suffix;
}

function generateParticipantId() {
  const now = new Date();
  const offset = 5 * 60 * 60 * 1000; // UTC+5
  const local = new Date(now.getTime() + offset);

  const yyyy = local.getUTCFullYear();
  const mm = String(local.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(local.getUTCDate()).padStart(2, '0');
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const min = String(local.getUTCMinutes()).padStart(2, '0');

  const timestamp = `${yyyy}${mm}${dd}${hh}${min}`;
  const suffix = getOrCreateRandomSuffix();

  return `P${timestamp}-${suffix}`;
}

// Генерируем каждый раз при загрузке страницы:
const participantId = generateParticipantId();
document.getElementById("pid").textContent = participantId;

function copyFixedCode() {
  const code = localStorage.getItem("participantSuffix");
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.querySelector('button[onclick="copyFixedCode()"]');
    const original = btn.textContent;
    btn.textContent = "✅";
    setTimeout(() => {
      btn.textContent = original;
    }, 1500);
  });
}


document.getElementById("fixed-code").textContent = getOrCreateRandomSuffix();


function getLocalTimestampKZ() {
  const offset = 5 * 60 * 60 * 1000; // UTC+5
  const localTime = new Date(Date.now() + offset);
  return localTime.toISOString().replace("T", " ").replace("Z", "");
}

function detectOS() {
  const { userAgent, platform } = navigator;
  const mac = /Mac/i.test(platform);
  const win = /Win/i.test(platform);
  const linux = /Linux/i.test(platform);
  const android = /Android/i.test(userAgent);
  const ios = /iPhone|iPad|iPod/i.test(userAgent);

  if (android) return "Android";
  if (ios) return "iOS";
  if (mac) return "MacOS";
  if (win) return "Windows";
  if (linux) return "Linux";
  return "Unknown";
}

function detectBrowser() {
  const ua = navigator.userAgent;
  if (/Chrome/.test(ua) && !/Edg/.test(ua) && !/OPR/.test(ua)) return "Chrome";
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return "Safari";
  if (/Firefox/.test(ua)) return "Firefox";
  if (/Edg/.test(ua)) return "Edge";
  if (/OPR/.test(ua)) return "Opera";
  return "Unknown";
}


window.addEventListener("DOMContentLoaded", async () => {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("🎙️ Microphone access granted.");
  } catch (err) {
    alert("Please allow microphone access.");
    console.error(err);
  }

  sessionIds.forEach(id => {
    document.getElementById("waveform-" + id)?.classList.remove("active");
  });
});

sessionIds.forEach(id => {
  document.getElementById("start-" + id).addEventListener("click", () => startRecording(id));
  document.getElementById("stop-" + id).addEventListener("click", () => stopRecording(id));
  document.getElementById("play-" + id).addEventListener("click", () => playAudio(id));
  document.getElementById("stopplay-" + id).addEventListener("click", () => stopAudio(id));
  document.getElementById("redo-" + id).addEventListener("click", () => redoSession(id));
});

function startRecording(id) {
  if (!micStream) return;
  audioContext = new AudioContext();
  sampleRates[id] = audioContext.sampleRate;
  audioBuffers[id] = [];

  const source = audioContext.createMediaStreamSource(micStream);
  processors[id] = audioContext.createScriptProcessor(4096, 1, 1);

  processors[id].onaudioprocess = e => {
    const channelData = e.inputBuffer.getChannelData(0);
    audioBuffers[id].push(new Float32Array(channelData));
  };

  source.connect(processors[id]);
  processors[id].connect(audioContext.destination);

  document.getElementById("waveform-" + id)?.classList.add("active");
}

function stopRecording(id) {
  if (!processors[id]) return;

  processors[id].disconnect();
  processors[id].onaudioprocess = null;

  const merged = mergeBuffers(audioBuffers[id]);
  const wavData = encodeWAV(merged, sampleRates[id]);
  const blob = new Blob([wavData], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);

  audios[id] = new Audio(url);

  recordedAt[id] = getLocalTimestampKZ();

  audios[id].blob = blob;

  const status = document.getElementById("status-" + id);
  status.textContent = "✅";
  status.classList.remove("not-recorded");
  status.classList.add("recorded");

  document.getElementById("waveform-" + id)?.classList.remove("active");

  const downloadLink = document.getElementById("download-" + id);
  if (downloadLink) {
    downloadLink.href = url;
    downloadLink.download = id + ".wav";
    downloadLink.style.display = "inline-block";
  }
  updateProgressCount();

}

function updateProgressCount() {
  let count = 0;
  sessionIds.forEach(id => {
    const status = document.getElementById("status-" + id);
    if (status?.classList.contains("recorded")) count++;
  });
  document.getElementById("session-progress").textContent = `Записано сессий: ${count} из ${sessionIds.length}`;
}


function playAudio(id) {
  const audio = audios[id];
  if (!audio) return;
  audio.play();
  isPlaying[id] = true;
  audio.onended = () => {
    isPlaying[id] = false;
  };
}

function stopAudio(id) {
  const audio = audios[id];
  if (!audio || !isPlaying[id]) return;
  audio.pause();
  audio.currentTime = 0;
  isPlaying[id] = false;
}

function redoSession(id) {
  audioBuffers[id] = [];
  audios[id] = null;
  isPlaying[id] = false;

  const status = document.getElementById("status-" + id);
  status.textContent = "⛔";
  status.classList.add("not-recorded");
  status.classList.remove("recorded");

  document.getElementById("waveform-" + id)?.classList.remove("active");

  const downloadLink = document.getElementById("download-" + id);
  if (downloadLink) {
    downloadLink.href = "";
    downloadLink.style.display = "none";
  }
  updateProgressCount();
}

function mergeBuffers(buffers) {
  const length = buffers.reduce((acc, b) => acc + b.length, 0);
  const result = new Float32Array(length);
  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    result.set(buffers[i], offset);
    offset += buffers[i].length;
  }
  return result;
}

function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);  // PCM
  view.setUint16(22, 1, true);  // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return view;
}


function generateMetadataJSON() {
  const recordings = [];
  sessionIds.forEach(id => {
    if (!audios[id] || !audios[id].blob) return;

    const [tech, sess] = id.split('-s');
    recordings.push({
      technique: techniques[tech],
      session: parseInt(sess),
      filename: id + ".wav",
      duration_sec: Math.round(audios[id].duration * 10) / 10,
      sample_rate: sampleRates[id],
      recorded_at: recordedAt[id]
    });
  });

  const metadata = {
    participant_id: participantId,
    datetime: getLocalTimestampKZ(),
    environment: {
        os: detectOS(),
        browser: detectBrowser(),
        language: navigator.language,
        languages: navigator.languages,
        deviceMemory: navigator.deviceMemory || null,
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        screen: {
        width: screen.width,
        height: screen.height
        },
        touchSupport: 'ontouchstart' in window,
        platform: navigator.platform,
        userAgent: navigator.userAgent
    },
    recordings: sessionIds.map(id => ({
        session: id,
        recorded: !!audios[id]?.blob,
        duration: audios[id]?.duration ? audios[id].duration.toFixed(2) : null
    })),
    format_version: "1.0"
  };

  return new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" });
}



document.getElementById("download-zip").addEventListener("click", async () => {
  const zip = new JSZip();
  let allReady = true;
  const recordings = [];

  for (let id of sessionIds) {
    const audio = audios[id];
    const status = document.getElementById("status-" + id);

    if (!audio?.blob || !status.classList.contains("recorded")) {
      allReady = false;
      break;
    }

    zip.file(`${id}.wav`, audio.blob);

    const [tech, sess] = id.split("-s");
    recordings.push({
      technique: techniques[tech],
      session: parseInt(sess),
      filename: `${id}.wav`,
      duration_sec: Math.round(audio.duration * 10) / 10,
      sample_rate: sampleRates[id],
      recorded_at: recordedAt[id]
    });
  }

  if (!allReady) {
    alert("Пожалуйста, завершите запись всех 9 сессий перед загрузкой ZIP.");
    return;
  }

  zip.file("metadata.json", JSON.stringify({
    participant_id: participantId,
    datetime: getLocalTimestampKZ(),
    environment: {
    os: detectOS(),
    browser: detectBrowser(),
    language: navigator.language,
    languages: navigator.languages,
    deviceMemory: navigator.deviceMemory || null,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    screen: {
      width: screen.width,
      height: screen.height
    },
    touchSupport: 'ontouchstart' in window,
    userAgent: navigator.userAgent
  },
  recordings: recordings,
  format_version: "1.0"
}, null, 2));

  const zipBlob = await zip.generateAsync({ type: "blob" });

  const dateStr = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12);
  saveAs(zipBlob, `breathing_${participantId}_${dateStr}.zip`);
});



