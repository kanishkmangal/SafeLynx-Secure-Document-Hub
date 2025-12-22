import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { activitySummary, fetchDocuments, fetchSharedDocuments, deleteDocument, fetchCategoryCounts } from '../api/documents';
import DocumentCard from '../components/DocumentCard';
import StatCard from '../components/StatCard';
import ActivityLog from '../components/ActivityLog';
import Typewriter from '../components/Typewriter';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [docs, setDocs] = useState([]);
  const [sharedDocs, setSharedDocs] = useState([]);
  const [activity, setActivity] = useState(null);
  const [categoryCounts, setCategoryCounts] = useState({ personal: 0, professional: 0, government: 0 });
  const [filter, setFilter] = useState({ category: 'personal', search: searchParams.get('search') || '' });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const categories = [
    { id: 'personal', label: 'Personal', color: 'blue' },
    { id: 'professional', label: 'Professional', color: 'purple' },
    { id: 'government', label: 'Government', color: 'emerald' },
  ];

  useEffect(() => {
    setFilter((prev) => ({ ...prev, search: searchParams.get('search') || '' }));
  }, [searchParams]);

  const updateSearch = (value) => {
    if (value.trim()) {
      setSearchParams((prev) => {
        prev.set('search', value);
        return prev;
      }, { replace: true });
    } else {
      setSearchParams((prev) => {
        prev.delete('search');
        return prev;
      }, { replace: true });
    }
  };

  /* ... inside Dashboard component ... */

  const loadData = async () => {
    try {
      setLoading(true);
      // Pass search filter to category counts to get dynamic counts based on query
      const [{ data: owned }, { data: shared }, { data: activityData }, { data: counts }] = await Promise.all([
        fetchDocuments(filter),
        fetchSharedDocuments(),
        activitySummary(),
        fetchCategoryCounts({ search: filter.search }),
      ]);

      setDocs(owned.documents);
      setSharedDocs(shared.documents);
      setActivity(activityData);
      setCategoryCounts(counts);

      // Auto-redirect logic
      if (filter.search) {
        const currentCount = counts[filter.category] || 0;
        if (currentCount === 0) {
          // If current category has no matches, find first category that has matches
          const firstMatch = categories.find(c => (counts[c.id] || 0) > 0);
          if (firstMatch) {
            setFilter(prev => ({ ...prev, category: firstMatch.id }));
          }
        }
      }

    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filter]);

  useEffect(() => {
    // Reset scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Disable scroll restoration
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      await deleteDocument(id);
      window.dispatchEvent(new Event('storageUpdated'));
      loadData();
    }
  };

  return (
    <div className="w-full min-h-screen space-y-6 animate-fadeIn">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2 h-14 sm:h-auto">
            <Typewriter text={`Welcome, ${user?.name || 'User'}`} speed={80} startDelay={300} />
          </h1>
          <p className="text-slate-600">Manage and organize your documents</p>
        </div>
        <button
          onClick={() => navigate('/upload', { state: { category: filter.category } })}
          className="btn btn-primary px-6 py-3 rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload Document
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="My Documents"
          value={activity?.totals?.owned || 0}
          accent="bg-blue-200"
          icon="upload"
        />
        <StatCard
          title="Shared with Me"
          value={activity?.totals?.sharedWithMe || 0}
          accent="bg-emerald-200"
          icon="share"
        />
        <StatCard
          title="Last Login"
          value={activity?.lastLogin ? new Date(activity.lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
          accent="bg-amber-200"
          icon="login"
        />
      </div>

      {/* Documents Section */}
      <div className="card border-0 bg-white/80 backdrop-blur-sm shadow-xl overflow-hidden">
        {/* Category Tabs */}
        <div className="flex items-center overflow-x-auto border-b border-slate-200 dark:border-gray-800">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter({ ...filter, category: cat.id })}
              className={`flex-1 min-w-[120px] px-6 py-4 text-sm font-semibold transition-all relative whitespace-nowrap ${filter.category === cat.id
                ? `text-${cat.color}-600 dark:text-${cat.color}-400 bg-${cat.color}-50 dark:bg-${cat.color}-900/10`
                : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800'
                }`}
            >
              {cat.label} <span className="ml-1 opacity-70">({categoryCounts[cat.id] || 0})</span>
              {filter.category === cat.id && (
                <div className={`absolute bottom-0 left-0 w-full h-0.5 bg-${cat.color}-600 dark:bg-${cat.color}-400`}></div>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-between items-center">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
              {filter.category} Documents
            </h2>
            <div className="relative w-full sm:w-auto sm:min-w-[300px]">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={`Search ${filter.category} documents...`}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-gray-600 bg-white dark:bg-[#18181B] text-slate-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                value={filter.search}
                onChange={(e) => updateSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : docs.length > 0 ? (
            <div className="relative">
              <div
                className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${docs.length > 6 ? 'max-h-[600px] overflow-y-auto custom-scrollbar pr-2' : ''
                  }`}
              >
                {docs.map((doc) => (
                  <DocumentCard key={doc._id} doc={doc} onDelete={handleDelete} />
                ))}
              </div>
              {/* Scroll fade hint */}
              {docs.length > 6 && (
                <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white dark:from-[#1A1A1D] to-transparent pointer-events-none rounded-b-xl mx-2" />
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className={`mx-auto h-20 w-20 rounded-full flex items-center justify-center mb-4 bg-slate-100 dark:bg-slate-800`}>
                <svg className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-slate-900 dark:text-white mb-1">No {filter.category} documents found</p>
              <p className="text-slate-500 dark:text-gray-400 mb-6">Upload your first {filter.category} document to get started</p>
              <button
                onClick={() => navigate('/upload', { state: { category: filter.category } })}
                className="btn btn-primary px-6 py-2"
              >
                Upload Document
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Shared Documents & Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6 border-0 bg-white/80 dark:bg-[#1A1A1D] backdrop-blur-sm shadow-xl relative">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Shared with You
          </h3>
          <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-2 scroll-smooth pb-4">
            {sharedDocs.length > 0 ? (
              sharedDocs.map((doc) => (
                <DocumentCard key={doc._id} doc={doc} />
              ))
            ) : (
              <p className="text-sm text-slate-500 dark:text-gray-400 text-center py-8">No shared documents yet</p>
            )}
          </div>
          {/* Scroll fade effect */}
          {sharedDocs.length > 3 && (
            <div className="absolute bottom-6 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-[#1A1A1D] to-transparent pointer-events-none rounded-b-2xl mx-1" />
          )}
        </div>
        <ActivityLog activity={activity} />
      </div>
    </div>
  );
};

export default Dashboard;

