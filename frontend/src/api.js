/* 백엔드 API 클라이언트 — 실패 시 호출부에서 목 데이터로 폴백 */

async function j(res) {
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export const listVideos = () => fetch("/api/videos").then(j);
export const getProgress = (id) => fetch(`/api/videos/${id}/progress`).then(j);
export const getReport = (id) => fetch(`/api/videos/${id}/report`).then(j);
export const searchApi = (q, mode) =>
  fetch(`/api/search?q=${encodeURIComponent(q)}&mode=${mode}`).then(j);
export const deleteVideo = (id) => fetch(`/api/videos/${id}`, { method: "DELETE" }).then(j);
export const getModels = () => fetch("/api/models").then(j);
export const getEstimate = (duration, interval, model) =>
  fetch(`/api/estimate?duration=${duration}&interval=${interval}&model=${encodeURIComponent(model)}`).then(j);

export function uploadVideo(file, onProgress, opts = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/videos");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(`upload ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("upload failed"));
    const form = new FormData();
    form.append("file", file);
    if (opts.model) form.append("model", opts.model);
    if (opts.interval) form.append("interval", opts.interval);
    xhr.send(form);
  });
}

/* 로컬에서 영상 길이(초) 읽기 — 업로드 전 비용 추정용 */
export function readDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration || 0); };
    v.onerror = () => { URL.revokeObjectURL(v.src); resolve(0); };
    v.src = URL.createObjectURL(file);
  });
}
