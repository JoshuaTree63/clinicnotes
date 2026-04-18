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

export const uploadTranscript = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/upload-transcript', formData, {
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
export const deleteSession = (id) => api.delete(`/sessions/${id}`);
export const indexPdfs = () => api.post("/index");
export const getIndexStatus = () => api.get("/index/status");

export const renameSpeaker = (sessionId, oldName, newName) =>
  api.post(`/sessions/${sessionId}/speakers/rename`, {
    old_name: oldName,
    new_name: newName,
  })

export const mergeSpeaker = (sessionId, fromName, intoName) =>
  api.post(`/sessions/${sessionId}/speakers/merge`, {
    from_name: fromName,
    into_name: intoName,
  })

export const removeSpeaker = (sessionId, name) =>
  api.post(`/sessions/${sessionId}/speakers/remove`, { name })

export const editTurn = (sessionId, turnIndex, text) =>
  api.post(`/sessions/${sessionId}/turns/${turnIndex}`, { text })

export const overrideTranscript = (sessionId, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/sessions/${sessionId}/transcript/override`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
