'use client';

import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  videoUrl: string;
  poster?: string;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  poster,
  className = 'w-full',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      let hls: Hls | null = null;

      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(videoUrl);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          if (videoRef.current) {
            videoRef.current.play();
          }
        });
      } else if (
        videoRef.current.canPlayType('application/vnd.apple.mpegurl')
      ) {
        videoRef.current.src = videoUrl;
        videoRef.current.addEventListener('loadedmetadata', function () {
          if (videoRef.current) {
            videoRef.current.play();
          }
        });
      }

      return () => {
        if (hls) {
          hls.detachMedia();
          hls.destroy();
        }
      };
    }
  }, [videoUrl]);

  return (
    <video
      ref={videoRef}
      controls
      className={className}
      poster={poster}
      style={{ backgroundColor: '#000' }}
    >
      Your browser does not support the video tag.
    </video>
  );
};

export default VideoPlayer;