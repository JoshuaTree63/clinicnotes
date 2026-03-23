import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
});

export const transcribeAudio = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const checkTranscribeStatus = (jobId) => {
  return api.get(`/transcribe/status/${jobId}`)
};

export const analyzeSession = (session_id) =>
  api.post("/analyze", { session_id });

export const getSessions = () => api.get("/sessions");
export const getSession = (id) => api.get(`/sessions/${id}`);
export const indexPdfs = () => api.post("/index");
export const getIndexStatus = () => api.get("/index/status");
