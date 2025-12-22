import { api } from './client';

export const fetchDocuments = (params) => api.get('/documents', { params });
export const fetchSharedDocuments = () => api.get('/documents/shared');
export const uploadDocument = (formData) =>
  api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const shareDocument = (id, email) => api.post(`/documents/${id}/share`, { email });
export const deleteDocument = (id) => api.delete(`/documents/${id}`);
export const getDocument = (id) => api.get(`/documents/${id}`);
export const activitySummary = () => api.get('/documents/activity');
export const fetchCategoryCounts = (params) => api.get('/documents/category-count', { params });
export const fetchDocumentTypes = () => api.get('/documents/types');
export const fetchStorageUsage = () => api.get('/documents/storage-usage');
export const renameDocument = (id, title) => api.patch(`/documents/${id}/rename`, { title });
export const regenerateDocument = (id) => api.post(`/documents/${id}/regenerate`);
export const generateSummary = (id) => api.post(`/documents/${id}/summary`);

