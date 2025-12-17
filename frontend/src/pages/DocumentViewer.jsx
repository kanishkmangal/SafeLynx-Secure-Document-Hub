import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteDocument, getDocument, shareDocument, regenerateDocument } from '../api/documents';

const DocumentViewer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [shareEmail, setShareEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const { data } = await getDocument(id);
      const document = data.document;
      // Ensure fileUrl is absolute (fix for old documents with relative URLs)
      if (document.fileUrl && !document.fileUrl.startsWith('http')) {
        const backendUrl = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || '';
        document.fileUrl = `${backendUrl}${document.fileUrl.startsWith('/') ? '' : '/'}${document.fileUrl}`;
      }
      setDoc(document);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load document');
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleShare = async (e) => {
    e.preventDefault();
    try {
      await shareDocument(id, shareEmail);
      setMessage('Shared successfully');
      setShareEmail('');
      setError('');
      load();
    } catch (err) {
      setMessage('');
      setError(err.response?.data?.message || 'Share failed');
    }
  };

  const handleDelete = async () => {
    await deleteDocument(id);
    navigate('/');
  };

  const handleRegenerate = async () => {
    try {
      const { data } = await regenerateDocument(id);
      setDoc(prev => ({ ...prev, summaryStatus: 'pending' }));
      // The poller will pick it up
    } catch (err) {
      setError('Failed to restart summary generation.');
    }
  };

  useEffect(() => {
    let interval;
    // Poll for summary updates if pending
    if (doc?.summaryStatus === 'pending') {
      interval = setInterval(async () => {
        try {
          // We can't use full load() because it resets other states/animations potentially
          // But simplest way is re-fetch. 
          const { data } = await getDocument(id);
          const updatedDoc = data.document;
          if (updatedDoc.summaryStatus !== 'pending') {
            setDoc(prev => ({ ...prev, ...updatedDoc }));
          }
        } catch (e) { console.error(e); }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [doc?.summaryStatus, id]);

  // --- Helper Functions for Rendering ---

  const getFileType = (url) => {
    if (!url) return 'unknown';
    // Remove query parameters if present and lowercase
    const cleanUrl = url.split('?')[0].toLowerCase();

    if (cleanUrl.endsWith('.pdf')) return 'pdf';

    const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'];
    if (imageExts.some(ext => cleanUrl.endsWith(ext))) return 'image';

    const officeExts = ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
    if (officeExts.some(ext => cleanUrl.endsWith(ext))) return 'office';

    return 'other';
  };

  const renderDocumentPreview = () => {
    if (!doc?.fileUrl) return null;

    const fileType = getFileType(doc.fileUrl);

    switch (fileType) {
      case 'pdf':
        return (
          <iframe
            title={doc.title}
            src={doc.fileUrl}
            className="w-full h-[600px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
            style={{ minHeight: '600px' }}
            type="application/pdf"
          />
        );
      case 'office':
        return (
          <iframe
            title={doc.title}
            src={`https://docs.google.com/gview?url=${encodeURIComponent(doc.fileUrl)}&embedded=true`}
            className="w-full h-[600px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
            style={{ minHeight: '600px' }}
          />
        );
      case 'image':
        return (
          <div className="flex items-center justify-center min-h-[500px] bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <img
              src={doc.fileUrl}
              alt={doc.title}
              className="max-w-full max-h-[600px] object-contain rounded-lg shadow-sm"
              onError={(e) => {
                e.target.src = '/placeholder-image.png';
                e.target.onerror = null;
                setError('Failed to load image');
              }}
            />
          </div>
        );
      default:
        // 'other' or unknown types
        return (
          <div className="flex flex-col items-center justify-center min-h-[500px] bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-slate-900 dark:text-white">Preview not available</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">This file type cannot be previewed directly.</p>
            </div>
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noreferrer"
              download
              className="btn btn-primary px-6 py-2 rounded-full"
            >
              Download File
            </a>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <button
        onClick={() => {
          if (window.history.state && window.history.state.idx > 0) {
            navigate(-1);
          } else {
            navigate('/dashboard');
          }
        }}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors group mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1 -ml-1"
        aria-label="Go back"
      >
        <svg
          className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold">Document</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{doc?.title}</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">{doc?.category}</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <a
            className="flex-1 md:flex-none btn bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg font-medium transition-colors text-center"
            href={doc?.fileUrl}
            target="_blank"
            rel="noreferrer"
            download
          >
            Download
          </a>
          <button
            className="flex-1 md:flex-none btn bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 dark:text-rose-400 px-4 py-2 rounded-lg font-medium transition-colors"
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="card p-4 md:col-span-2 min-h-[500px] bg-white/80 dark:bg-[#1A1A1D] border border-slate-200 dark:border-slate-800">
          {doc && renderDocumentPreview()}
          {!doc && <div className="flex items-center justify-center h-[500px] text-slate-500 dark:text-slate-400">Loading document...</div>}
        </div>

        <div className="flex flex-col gap-6">
          {/* AI Summary Card */}
          <div className="card p-6 bg-white/80 dark:bg-[#1A1A1D] border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="font-bold text-lg text-slate-900 dark:text-white">AI Summary</p>
            </div>

            {doc?.summaryStatus === 'pending' && (
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-sm text-slate-500 animate-pulse">Generating AI summary...</p>
              </div>
            )}

            {doc?.summaryStatus === 'completed' && (
              <div className="space-y-4">
                <div className="prose prose-sm dark:prose-invert max-h-[300px] overflow-y-auto custom-scrollbar">
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                    {doc.summary || "Summary not available."}
                  </p>
                </div>
                <div className="flex justify-end border-t border-slate-100 dark:border-slate-800 pt-2">
                  <button
                    onClick={handleRegenerate}
                    className="text-xs flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Regenerate Summary
                  </button>
                </div>
              </div>
            )}

            {doc?.summaryStatus === 'failed' && (
              <div className="space-y-4">
                <div className="text-center py-4 text-rose-500 text-sm bg-rose-50 dark:bg-rose-900/10 rounded-lg whitespace-pre-line px-4">
                  <p className="font-semibold mb-1">Unable to generate summary</p>
                  <p className="text-xs opacity-80">{doc.summary || "Unknown error occurred."}</p>
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={handleRegenerate}
                    className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {doc?.summaryStatus === 'none' && !doc && (
              <div className="text-slate-400 text-sm text-center">Loading...</div>
            )}
          </div>

          <div className="card p-6 space-y-6 h-fit bg-white/80 dark:bg-[#1A1A1D] border border-slate-200 dark:border-slate-800">
            <div>
              <p className="font-bold text-lg text-slate-900 dark:text-white">Share Document</p>
              <p className="text-sm text-slate-500 dark:text-gray-400">Share securely with another registered user.</p>
            </div>
            <form className="space-y-3" onSubmit={handleShare}>
              <div>
                <label className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Recipient Email</label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-[#18181B] px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  placeholder="user@example.com"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  required
                />
              </div>
              <button className="btn btn-primary w-full py-2.5 shadow-lg shadow-indigo-500/20">Share Access</button>
            </form>
            {message && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-sm font-medium">
                {message}
              </div>
            )}
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-3">Shared with</p>
              <div className="space-y-2">
                {doc?.sharedWith?.length ? (
                  doc.sharedWith.map((userId) => (
                    <div key={userId} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
                        U
                      </div>
                      <span className="truncate">User ID: {userId}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 italic">No recipients yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
