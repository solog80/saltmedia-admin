"use client"
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../lib/firebase';
import * as tus from 'tus-js-client';
import { redirect } from 'next/navigation'; // Added import
import { useAuth } from '@/context/AuthContext'; // Added import
import styles from './page.module.css'; // Added import

// Material-UI Imports
import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField,
  CircularProgress, LinearProgress, IconButton, MenuItem, Select, InputLabel, FormControl,
  Accordion, AccordionSummary, AccordionDetails, Typography
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { fetchOnDemandData } from '../../lib/queries';
import OnDemandCard from '../components/OnDemandCard';
import { OnDemandContent } from '../../types/ondemand';

// Initialize Firebase Functions (ensure this matches your deployed function region)
const functions = getFunctions(app, 'us-central1');

const queryClient = new QueryClient();

function OndemandContent() {
  const { user, loading } = useAuth(); // Re-introduced useAuth
  const queryClient = useQueryClient();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [metaTagProperty, setMetaTagProperty] = useState('');
  const [metaTagValue, setMetaTagValue] = useState('');
  const fileInputRef = useRef(null);

  // State for Edit Dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMetaTagProperty, setEditMetaTagProperty] = useState('');
  const [editMetaTagValue, setEditMetaTagValue] = useState('');

  // State for Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState(null);

  if (loading) { // Re-introduced auth loading
    return <div>Loading authentication...</div>;
  }

  if (!user) { // Re-introduced auth redirect
    redirect('/login');
  }

  const { data, isLoading, error } = useQuery<{ documents: OnDemandContent[] }>({ // Explicitly type the data
    queryKey: ['onDemandData', selectedFilter],
    queryFn: fetchOnDemandData,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (data?.documents && data.documents.length > 0 && !selectedCollectionId) { // Changed from playlists to data?.documents
      setSelectedCollectionId(data.documents[0].id); // Assuming id is the collection identifier
    }
  }, [data?.documents, selectedCollectionId]); // Changed from playlists to data?.documents

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoTitle(file.name.split('.')[0]);
    }
  };

  const handleUpload = async () => {
    if (!videoFile || !selectedCollectionId || !videoTitle) {
      alert('Please select a file, a collection, and provide a title.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const createTusUploadCallable = httpsCallable(functions, 'createTusUpload');
      const metaTags = (metaTagProperty && metaTagValue) ? [{
        property: metaTagProperty,
        value: metaTagValue
      }] : [];

      const resp = await createTusUploadCallable({
        title: videoTitle,
        description: videoDescription,
        collectionId: selectedCollectionId,
        metaTags: metaTags,
      });

      const { videoId, expirationTime, signature } = resp.data;

      const upload = new tus.Upload(videoFile, {
        endpoint: "https://video.bunnycdn.com/tusupload",
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          'AuthorizationSignature': signature,
          'AuthorizationExpire': expirationTime.toString(),
          'VideoId': videoId,
          'LibraryId': '307069',
        },
        metadata: {
          filename: videoFile.name,
          filetype: videoFile.type,
          title: videoTitle,
          collection: selectedCollectionId,
        },
        onError: function (error) {
          console.error("Failed because: " + error);
          alert("Upload failed: " + error);
          setIsUploading(false);
          setUploadProgress(0);
        },
        onProgress: function (bytesUploaded, bytesTotal) {
          const percentage = (bytesUploaded / bytesTotal * 100).toFixed(1);
          setUploadProgress(parseFloat(percentage));
        },
        onSuccess: function () {
          console.log("Download %s from %s", upload.url, upload.file.name);
          alert('Video uploaded successfully!');
          setIsUploading(false);
          setUploadProgress(0);
          setVideoFile(null);
          setVideoTitle('');
          setVideoDescription('');
          setMetaTagProperty('');
          setMetaTagValue('');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          queryClient.invalidateQueries(['onDemandData']);
        }
      });

      upload.start();

    } catch (error) {
      console.error('Error during upload process:', error);
      alert(`Upload failed: ${error.message}`);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Edit Dialog Handlers
  const handleOpenEditDialog = (video: OnDemandContent) => { // Typed video
    setCurrentVideo(video);
    setEditTitle(video.title || '');
    setEditDescription(video.description || '');
    // Assuming metaTags is an array of objects with property and value
    const currentMetaTag = video.metaTags && video.metaTags.length > 0 ? video.metaTags[0] : {};
    setEditMetaTagProperty(currentMetaTag.property || '');
    setEditMetaTagValue(currentMetaTag.value || '');
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setCurrentVideo(null);
  };

  const handleSaveEdit = async () => {
    if (!currentVideo) return;

    try {
      const updateVideoInfoCallable = httpsCallable(functions, 'updateVideoInfo');
      const metaTags = (editMetaTagProperty && editMetaTagValue) ? [{
        property: editMetaTagProperty,
        value: editMetaTagValue
      }] : [];

      await updateVideoInfoCallable({
        videoId: currentVideo.id, // Assuming currentVideo.id is the videoId
        title: editTitle,
        description: editDescription,
        metaTags: metaTags,
      });
      alert('Video info updated successfully!'); // Replace with Snackbar later
      queryClient.invalidateQueries(['onDemandData']);
      handleCloseEditDialog();
    } catch (error) {
      console.error('Error updating video info:', error);
      alert(`Failed to update video info: ${error.message}`); // Replace with Snackbar later
    }
  };

  // Delete Dialog Handlers
  const handleOpenDeleteDialog = (video: OnDemandContent) => { // Typed video
    setVideoToDelete(video);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setVideoToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!videoToDelete) return;

    try {
      const deleteVideoCallable = httpsCallable(functions, 'deleteVideo');
      await deleteVideoCallable({ videoId: videoToDelete.id }); // Assuming videoToDelete.id is the videoId
      alert('Video deleted successfully!'); // Replace with Snackbar later
      queryClient.invalidateQueries(['onDemandData']);
      handleCloseDeleteDialog();
    } catch (error) {
      console.error('Error deleting video:', error);
      alert(`Failed to delete video: ${error.message}`); // Replace with Snackbar later
    }
  };

  if (isLoading) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>On Demand</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Simple Loading Skeleton */}
          {[...Array(4)].map((_, index) => (
            <div key={index} className="border border-blue-300 shadow rounded-md p-4 max-w-sm w-full mx-auto">
              <div className="animate-pulse flex space-x-4">
                <div className="rounded-full bg-slate-200 h-10 w-10"></div>
                <div className="flex-1 space-y-6 py-1">
                  <div className="h-2 bg-slate-200 rounded"></div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="h-2 bg-slate-200 rounded col-span-2"></div>
                      <div className="h-2 bg-slate-200 rounded col-span-1"></div>
                    </div>
                    <div className="h-2 bg-slate-200 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (error) return <div>Error: {error.message}</div>;

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>On Demand</h1>
      {data?.documents && data.documents.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.documents.map((item: OnDemandContent) => (
            <OnDemandCard
              key={item.id}
              image={item.image}
              title={item.title}
              description={item.description}
              link={`/ondemand/${item.id}`}
            />
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 mt-8">No on-demand content available.</div>
      )}
    </main>
  );
}

export default function OndemandPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <OndemandContent />
    </QueryClientProvider>
  );
}