import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { instanceNoAuth } from "../utils/axiosInstance";
import PdfViewer from "../components/PdfViewer/PdfViewer";
import LoadingSpinner from "../components/LoadingSpinner/LoadingSpinner";
import styles from "./DocumentReaderWrapper.module.scss";

import {
  FaArrowLeft, FaBookOpen, FaSearch, FaVolumeUp,
  FaFont, FaMoon, FaSun, FaExpand, FaBookmark
} from "react-icons/fa";
import toast from "react-hot-toast";


const DocumentReaderWrapper: React.FC = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("Document");
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [showTools, setShowTools] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showExtendedLoading, setShowExtendedLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<string>("00:00");
  const [totalTime, setTotalTime] = useState<string>("00:00");
  const [selectedVoice, setSelectedVoice] = useState<string>("en-US-JennyNeural");
  const [speedRate, setSpeedRate] = useState<number>(1.0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const handleSpeak = () => {
    if (!(window as any).pdfViewerControls) {
      toast.error("PDF viewer not ready");
      return;
    }

    const controls = (window as any).pdfViewerControls;

    if (controls.isReading()) {
      // If already reading, stop
      controls.stopReading();
      setIsPlaying(false);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    } else {
      // Start reading
      controls.startReading();
      setIsPlaying(true);

      // Simulate progress (since we don't have actual progress feedback from the SDK)
      let currentProgress = 0;
      progressInterval.current = setInterval(() => {
        currentProgress += 0.5;
        if (currentProgress >= 100) {
          clearInterval(progressInterval.current as NodeJS.Timeout);
          setIsPlaying(false);
          setProgress(0);
          setCurrentTime("00:00");
        } else {
          setProgress(currentProgress);

          // Update time display (rough approximation)
          const totalSeconds = 180; // Assume 3 minutes for demo
          const currentSeconds = Math.floor(totalSeconds * (currentProgress / 100));
          setCurrentTime(formatTime(currentSeconds));
          setTotalTime(formatTime(totalSeconds));
        }
      }, 1000);
    }
  }

  const handlePause = () => {
    if (!(window as any).pdfViewerControls) return;

    // In current implementation, we can only stop
    (window as any).pdfViewerControls.stopReading();
    setIsPlaying(false);

    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  }

  const handleStop = () => {
    if (!(window as any).pdfViewerControls) return;

    (window as any).pdfViewerControls.stopReading();
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime("00:00");

    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  }

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVoice = e.target.value;
    setSelectedVoice(newVoice);

    if ((window as any).pdfViewerControls) {
      (window as any).pdfViewerControls.changeVoice(newVoice);
    }
  }

  const handleSpeedChange = (speed: number) => {
    setSpeedRate(speed);

    if ((window as any).pdfViewerControls) {
      (window as any).pdfViewerControls.changePlaybackRate(speed);
    }
  }

  // Format seconds to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }



  // Effect to handle extended loading time
  useEffect(() => {
    let loadingTimer: NodeJS.Timeout;

    if (!isLoading && file) {
      // When regular loading finishes but we have a file, show extended loading
      setShowExtendedLoading(true);

      // Keep showing the loading spinner for 5 more seconds
      loadingTimer = setTimeout(() => {
        setShowExtendedLoading(false);
      }, 5000);
    }

    return () => {
      if (loadingTimer) clearTimeout(loadingTimer);
    };
  }, [isLoading, file]);

  // Clean up resources when unmounting
  useEffect(() => {
    return () => {
      // Stop any ongoing speech synthesis
      if ((window as any).pdfViewerControls) {
        (window as any).pdfViewerControls.stopReading();
      }

      // Clear progress interval
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    try {
      // Clear previous file before loading new one
      setFile(null);
      setIsLoading(true);
      const file = e.target.files[0];
      setFileName(file.name);

      const formData = new FormData();
      formData.append("file", file);

      let fileUrl: string;

      if (file.type === "application/pdf") {
        // Add a small delay to ensure the UI has time to clear the previous PDF
        await new Promise(resolve => setTimeout(resolve, 100));
        fileUrl = URL.createObjectURL(file);
      } else {
        const response = await instanceNoAuth.post("/to-pdf/convert-docx", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          responseType: "blob",
        });

        const fileBlob = new Blob([response.data], { type: "application/pdf" });
        fileUrl = URL.createObjectURL(fileBlob);
      }

      setFile(fileUrl);
      toast.success("Document ready to read!");
    } catch (err) {
      console.error("Error loading document:", err);
      toast.error("Failed to process document");
    } finally {
      setIsLoading(false);
    }
  };

  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className={`${styles.container} ${darkMode ? styles.darkMode : ''}`}>
      {/* Show loading spinner either during upload processing or extended loading phase */}
      {(isLoading || showExtendedLoading) && (
        <LoadingSpinner
          message={"Processing your document..."}
        />
      )}

      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate("/profile")}>
          <FaArrowLeft />
        </button>
        <h1 className={styles.title}>
          <FaBookOpen /> {fileName}
        </h1>
        <div className={styles.headerControls}>
          <button
            className={styles.iconButton}
            onClick={toggleDarkMode}
            title={darkMode ? "Light Mode" : "Dark Mode"}
          >
            {darkMode ? <FaSun /> : <FaMoon />}
          </button>
          <button
            className={styles.iconButton}
            onClick={() => setShowTools(!showTools)}
            title={showTools ? "Hide Tools" : "Show Tools"}
          >
            <FaFont />
          </button>
        </div>
      </header>
      {showTools && (
        <div className={styles.toolsBar}>
          <div className={styles.toolGroup}>
            <button className={styles.toolButton} onClick={openFileDialog}>
              Open Document
            </button>
            <button className={styles.toolButton}>
              <FaSearch /> Search
            </button>
            <button className={styles.toolButton}>
              <FaBookmark /> Bookmarks
            </button>
          </div>
          <div className={styles.aiGroup}></div>
        </div>
      )}

      <div className={styles.content}>
        {!file ? (
          <div className={styles.uploadPrompt}>
            <div className={styles.uploadCard}>
              <FaBookOpen className={styles.bookIcon} />
              <h2>Start Reading</h2>
              <p>Upload a document to view and prepare for AI reading</p>
              <button className={styles.uploadButton} onClick={openFileDialog}>
                Select Document
              </button>
              <div className={styles.formatNote}>
                Supports PDF, DOCX, and TXT files
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.readerView}>
            <PdfViewer file={file} />
          </div>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.docx,.doc,.txt"
        style={{ display: 'none' }}
      />

      {file && (
        <div className={styles.audioPlayerBar}>
          <div className={styles.audioControls}>
            <button
              className={styles.audioButton}
              onClick={handleSpeak}
              title="Toggle Read Aloud"
            >
              <FaVolumeUp size={18} />
            </button>
            <div className={styles.playbackControls}>
              <button
                className={styles.controlButton}
                title={isPlaying ? "Pause" : "Play"}
                onClick={isPlaying ? handlePause : handleSpeak}
              >
                <i className={isPlaying ? styles.pauseIcon : styles.playIcon}></i>
              </button>
              <button
                className={styles.controlButton}
                title="Stop"
                onClick={handleStop}
              >
                <i className={styles.stopIcon}></i>
              </button>
            </div>
          </div>

          <div className={styles.progressContainer}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }}></div>
            </div>
            <div className={styles.timeDisplay}>{currentTime} / {totalTime}</div>
          </div>

          <div className={styles.audioSettings}>
            <select
              className={styles.voiceSelect}
              value={selectedVoice}
              onChange={handleVoiceChange}
            >
              <option value="en-US-JennyNeural">US English (Female)</option>
              <option value="en-GB-SoniaNeural">UK English (Female)</option>
              <option value="en-AU-NatashaNeural">Australian (Female)</option>
              <option value="pl-PL-MarekNeural">Polish (Male)</option>
              <option value="pl-PL-ZofiaNeural">Polish (Female)</option>
              <option value="de-DE-KatjaNeural">German (Female)</option>
              <option value="fr-FR-DeniseNeural">French (Female)</option>
              <option value="es-ES-ElviraNeural">Spanish (Female)</option>
            </select>
            <div className={styles.speedControl}>
              <button
                className={`${styles.speedButton} ${speedRate === 0.75 ? styles.active : ''}`}
                onClick={() => handleSpeedChange(0.75)}
              >
                0.75x
              </button>
              <button
                className={`${styles.speedButton} ${speedRate === 1.0 ? styles.active : ''}`}
                onClick={() => handleSpeedChange(1.0)}
              >
                1x
              </button>
              <button
                className={`${styles.speedButton} ${speedRate === 1.5 ? styles.active : ''}`}
                onClick={() => handleSpeedChange(1.5)}
              >
                1.5x
              </button>
              <button
                className={`${styles.speedButton} ${speedRate === 2.0 ? styles.active : ''}`}
                onClick={() => handleSpeedChange(2.0)}
              >
                2x
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentReaderWrapper;