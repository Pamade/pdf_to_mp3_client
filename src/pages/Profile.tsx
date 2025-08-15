import { useEffect, useState } from 'react';
import styles from './Profile.module.scss';
import toast from 'react-hot-toast';
import { instance, instanceNoAuth } from '../utils/axiosInstance';
import { useGetGoogleVoices } from '../customHooks/useGetGoogleVoices';
import { UploadModal } from '../components/PDFUploader/UploadModal';
import { usePlaySample } from '../customHooks/usePlaySample';
import { useDownload } from '../context/DownloadContext';
import { DownloadBar } from '../components/DownloadBar/DownloadBar';

interface UserStorage {
  available: number; // in MB
}

interface AudioFile {
  audioCreatedAt: string;
  audioFileSizeMb: number;
  audioFormat: string;
  audioId: number;
  audioPublicId: string;
  audioSignedUrl: string;
  cloudinaryTextId: number;
  documentName: string;
  durationSeconds: number;
  filename: string;
  gender: string;
  language: string;
  textPublicId: string;
  textSignedUrl: string;
  textSize: number;
  uploadedAt: string;
  userFileId: number;
  voice: string;
}

interface CloudinaryText {
  id: number;
  documentName: string;
  filename: string;
  publicId: string;
  signedUrl: string;
  size: number;
  gender: string;
  voice: string;
  language: string;
  uploadedAt: string;
  status?: 'generating' | 'completed';
}

export function Profile() {
  const {
    languages,
    genders,
    voices,
    filteredVoices,
    selectedLanguage,
    setSelectedLanguage,
    selectedGender,
    setSelectedGender,
    selectedVoice,
    handleVoiceSelect,
  } = useGetGoogleVoices();

  const { downloadState, startDownload, updateProgress, resetDownload } = useDownload();

  const {
    isSamplePlaying,
    isPreparing,
    handleSampleButtonClick,
    stopSamplePlayback
  } = usePlaySample();

  const [activeTab, setActiveTab] = useState<'text' | 'audio'>('text');
  const [texts, setTexts] = useState<CloudinaryText[]>([]);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(4);
  const [search, setSearch] = useState('');
  const [selectedAudioItem, setSelectedAudioItem] = useState<AudioFile | null>(null);
  const [isViewingAudioDetails, setIsViewingAudioDetails] = useState(false);

  const [storage, setStorage] = useState<UserStorage>({
    available: 0,
  });

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [isEditingText, setIsEditingText] = useState(false);
  const [selectedText, setSelectedText] = useState<CloudinaryText | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('');

  const [languageChanged, setLanguageChanged] = useState(false);
  const [genderChanged, setGenderChanged] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const filteredItems = activeTab === 'audio' ? audioFiles.filter(audio => {
    const searchFilter = search.trim() === '' ? true :
      audio.documentName.toLowerCase().includes(search.toLowerCase()) ||
      audio.language.toLowerCase().includes(search.toLowerCase());
    return searchFilter;
  }) : texts.filter(text => {
    const searchFilter = search.trim() === '' ? true :
      text.documentName.toLowerCase().includes(search.toLowerCase()) ||
      text.language.toLowerCase().includes(search.toLowerCase());
    return searchFilter;
  });

  useEffect(() => {
    const handleProcessingCancelled = (event: CustomEvent<{ fileName: string }>) => {
      const fileName = event.detail.fileName;
      setTexts(prevTexts =>
        prevTexts.map(text => {
          const textName = text.documentName.split('/').pop()?.replace('.txt', '') || '';
          return textName === fileName ? { ...text, status: undefined } : text;
        })
      );
    };

    const handleProcessingComplete = (_: CustomEvent<{ fileName: string }>) => {
      // Refresh the file list immediately when processing is complete
      fetchUserData();
    };

    window.addEventListener('processingCancelled', handleProcessingCancelled as EventListener);
    window.addEventListener('processingComplete', handleProcessingComplete as EventListener);

    return () => {
      window.removeEventListener('processingCancelled', handleProcessingCancelled as EventListener);
      window.removeEventListener('processingComplete', handleProcessingComplete as EventListener);
    };
  }, []);

  const fetchUserData = async () => {
    setIsLoadingFiles(true);
    try {
      const transferResponse = await instance.get<{ transfer: number }>('/available_transfer/get');
      setStorage(prev => ({
        ...prev,
        available: transferResponse.data.transfer
      }));

      const textsResponse = await instance.get<CloudinaryText[]>(`/files/with-urls`);
      const audiosResponse = await instance.get<AudioFile[]>(`/files/with-urls-audio`);

      if (textsResponse.data) {
        setTexts(textsResponse.data.map(text => ({
          ...text,
          txtUrl: text.signedUrl,
          documentName: text.documentName
        })));
      }

      if (audiosResponse.data) {
        setAudioFiles(audiosResponse.data);
      }
    } catch (error: any) {
      if (error.response?.status === 204) {
        setTexts([]);
      }
      console.error('Error fetching user data:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchUserData();

  }, []);

  useEffect(() => {

    if (selectedLanguage && languageChanged) {
      const firstVoice = filteredVoices.find(voice => voice.language === selectedLanguage);
      if (firstVoice && firstVoice.name !== selectedVoice?.name) {
        handleVoiceSelect(firstVoice);
      }
      setLanguageChanged(false);
    }
  }, [selectedLanguage, filteredVoices, languageChanged]);

  useEffect(() => {

    if (selectedGender && genderChanged) {
      const firstVoice = filteredVoices.find(voice => voice.gender === selectedGender);
      if (firstVoice && firstVoice.name !== selectedVoice?.name) {
        handleVoiceSelect(firstVoice);
      }
      setGenderChanged(false);
    }
  }, [selectedGender, filteredVoices, genderChanged]);

  useEffect(() => {
    if (isEditingText && selectedText && voices.length > 0) {
      const matchingVoice = voices.find(v => v.name === selectedText.voice);
      if (matchingVoice) {
        handleVoiceSelect(matchingVoice);
      }
    }
  }, [isEditingText, selectedText, voices]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await instance.post('/user/change-password', passwordForm);
      setIsChangingPassword(false);
    } catch (error) {
      console.error('Error changing password:', error);
    }
  };

  const handleGenerateMP3 = async (textId: number, fileSize: number, text: CloudinaryText) => {

    if (fileSize > storage.available) {
      toast.error(`Not enough available transfer. Need ${fileSize.toFixed(2)}MB but only have ${storage.available.toFixed(2)}MB available.`);
      return;
    }

    if (downloadState.isProcessing) {
      toast.error('Please wait for the current file to finish processing.', {
        duration: 4000,
        position: 'top-center',
      });
      return;
    }

    let isCancelled = false;
    const handleCancel = () => {
      isCancelled = true;
    };
    window.addEventListener('processingCancelled', handleCancel);

    try {

      setTexts(texts.map(t =>
        t.id === textId ? { ...t, status: 'generating' } : t
      ));

      let actualTextContent = '';

      try {
        const textResponse = await fetch(text.signedUrl);
        actualTextContent = await textResponse.text();
        actualTextContent = actualTextContent.trim();

        if (!actualTextContent) {
          throw new Error('Text content is empty');
        }
      } catch (error) {
        console.error('Error fetching text content:', error);
        alert('Error loading text content. Please try again.');
        setTexts(texts.map(t =>
          t.id === textId ? { ...t, status: undefined } : t
        ));
        return;
      }

      const audioChunks: string[] = [];
      const splitTextIntoChunks = (text: string, maxBytes = 899): string[] => {
        let processedText = text
          .replace(/\.\s*/g, ".\n")
          .replace(/,\s*/g, ", ")
          .split("\n")
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .join("\n");

        const sentenceEndPattern = /[.!?]+\s+/g;
        const clauseEndPattern = /[,;:]\s+/g;

        const sentences = processedText.split(sentenceEndPattern);
        const chunks: string[] = [];
        let currentChunk = "";

        const encoder = new TextEncoder();
        const getBytes = (str: string) => encoder.encode(str).length;

        function pushCurrentChunk() {
          if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
          }
        }

        function splitLongSentence(sentence: string) {
          const clauses = sentence.split(clauseEndPattern);
          let localChunk = "";
          for (let clause of clauses) {
            clause = clause.trim();
            if (!clause.match(/[.!?]$/)) clause += ".";
            if (getBytes(localChunk + " " + clause) > maxBytes) {
              if (localChunk) chunks.push(localChunk.trim());
              localChunk = clause;
            } else {
              localChunk += (localChunk ? " " : "") + clause;
            }
          }
          if (localChunk) chunks.push(localChunk.trim());
        }

        for (let sentence of sentences) {
          sentence = sentence.trim();
          if (!sentence.match(/[.!?]$/)) sentence += ".";

          const sentenceBytes = getBytes(sentence);
          const currentBytes = getBytes(currentChunk);

          if (sentenceBytes > maxBytes) {
            splitLongSentence(sentence);
          } else if (currentBytes + sentenceBytes > maxBytes) {
            pushCurrentChunk();
            currentChunk = sentence;
          } else {
            currentChunk += (currentChunk ? " " : "") + sentence;
          }
        }

        pushCurrentChunk();
        return chunks;
      }

      const textChunks = splitTextIntoChunks(actualTextContent, 899);

      startDownload(
        text.documentName.split('/').pop()?.replace('.txt', '') || 'File',
        textChunks.length,
        text.voice,
        text.language
      );

      for (let i = 0; i < textChunks.length; i++) {
        if (isCancelled) {
          window.removeEventListener('processingCancelled', handleCancel);
          setTexts(texts.map(t =>
            t.id === textId ? { ...t, status: undefined } : t
          ));
          return;
        }

        try {
          const chunkResponse = await instanceNoAuth.post('/tts/synthesize-chunk', {
            text: textChunks[i],
            chunkIndex: i,
            languageCode: text.voice.slice(0, 5),
            voiceName: text.voice
          }, {
            responseType: "arraybuffer"
          });

          const base64Audio = arrayBufferToBase64(chunkResponse.data);
          audioChunks.push(base64Audio);

          updateProgress(i + 1);
        } catch (error) {
          console.error(`Error generating chunk ${i + 1}:`, error);
        }

        function arrayBufferToBase64(buffer: ArrayBuffer): string {
          let binary = '';
          const bytes = new Uint8Array(buffer);
          const chunkSize = 0x8000;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as any);
          }
          return btoa(binary);
        }


      }

      const finalResponse = await instanceNoAuth.post('/tts/combine-chunks', {
        chunks: audioChunks
      }, {
        responseType: 'arraybuffer',  // Make sure this is set
        headers: {
          'Accept': 'audio/mpeg'  // Add this to ensure proper content type handling
        }
      });

      const audioBlob = new Blob([finalResponse.data], {
        type: 'audio/mpeg'  // Make sure this is consistent
      });

      const fileName = text.documentName.split('/').pop()?.replace(/\.(txt|pdf|docx)$/, '') || 'audio';
      const file = new File([audioBlob], `${fileName}.mp3`, {
        type: 'audio/mpeg'
      });

      const formData = new FormData()
      formData.append('audioFile', file)
      formData.append('cloudinaryTextId', String(text.id))

      try {
        // Show success message about generation completion
        toast.success('Generation completed! File will be available in the Audio Files tab.', {
          duration: 4000,
          position: 'top-center'
        });

        // Then upload the MP3
        await instance.post('/files/upload-mp3', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        const notificationFormData = new FormData();
        notificationFormData.append('audioFile', file);

        // First show a loading toast
        const loadingToast = toast.loading('Sending audio file to your email...', {
          position: 'top-center'
        });

        try {
          await instance.post('/files/notify-audio-ready',
            notificationFormData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });

          // Dismiss the loading toast and show success
          toast.dismiss(loadingToast);
          toast.success('Audio file has been sent to your email!', {
            duration: 4000,
            position: 'top-center'
          });

        } catch (e) {
          // Dismiss the loading toast and show error
          toast.dismiss(loadingToast);
          toast.error('Failed to send audio file to email. Please try again.', {
            duration: 4000,
            position: 'top-center'
          });
          console.error("Email sending failed:", e);
        }

        const [textsResponse, audiosResponse] = await Promise.all([
          instance.get<CloudinaryText[]>(`/files/with-urls`),
          instance.get<AudioFile[]>(`/files/with-urls-audio`)
        ]);

        if (textsResponse.data) {
          setTexts(textsResponse.data.map(text => ({
            ...text,
            txtUrl: text.signedUrl,
            documentName: text.documentName,
            status: text.id === textId ? undefined : text.status
          })));
        }

        if (audiosResponse.data) {
          setAudioFiles(audiosResponse.data);
        }

        // States have been updated, no need to download again
      }
      catch (e) {
        console.error("Upload failed:", e);
        // In case of error, just remove the generating status
        setTexts(prevTexts =>
          prevTexts.map(t =>
            t.id === textId ? { ...t, status: undefined } : t
          )
        );
      }

      resetDownload();

    } catch (error) {
      resetDownload();
      // Use the callback form of setState to ensure we have the latest state
      setTexts(prevTexts =>
        prevTexts.map(t =>
          t.id === textId ? { ...t, status: undefined } : t
        )
      );
    } finally {
      window.removeEventListener('processingCancelled', handleCancel);
      // Fetch fresh data one last time to ensure everything is in sync
      fetchUserData();
    }
  };

  const formatSize = (mb: number) => {
    return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(2)} MB`;
  };

  const TextIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
    </svg>
  );

  const AudioIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z" />
    </svg>
  );

  const handleSaveChanges = async () => {
    if (!selectedText || !selectedVoice) return;

    try {
      stopSamplePlayback();
      const response = await instance.patch(`/cloudinary/text/update/${selectedText.id}`, {
        language: selectedLanguage,
        gender: selectedGender,
        voice: selectedVoice.name || "",
      });

      setTexts(texts.map(text =>
        text.id === selectedText.id
          ? {
            ...text,
            language: selectedLanguage,
            languageCode: selectedVoice.language_code, // Add languageCode here too
            gender: selectedGender,
            voice: selectedVoice.name
          }
          : text
      ));

      setIsEditingText(false);
      console.log("Upload success:", response.data);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const fetchTextContent = async (url: string) => {
    setIsLoadingContent(true);
    try {
      const response = await fetch(url);
      const text = await response.text();
      setTextContent(text.trim());
    } catch (error) {
      setTextContent('Error loading text content');
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    setLanguageChanged(true); // Set the flag to true when the language changes
  };

  const handleGenderChange = (gender: string) => {
    setSelectedGender(gender);
    setGenderChanged(true); // Set the flag to true when the gender changes
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>My Dashboard</h1>
        <div className={styles.storageInfo}>
          <div className={styles.storageText}>
            <span>Available Transfer: <strong>{formatSize(storage.available)}</strong></span>
          </div>
          <button className={styles.buyButton}>
            Buy More Transfer
          </button>
        </div>
      </header>

      <div className={styles.dashboard}>
        <div className={styles.mainContent}>
          <nav className={styles.tabNav}>
            <button
              className={`${styles.tab} ${activeTab === 'text' ? styles.active : ''}`}
              onClick={() => {
                setActiveTab('text');
                setCurrentPage(1);
                setPageInputValue('1');
              }}
            >
              Text Files
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'audio' ? styles.active : ''}`}
              onClick={() => {
                setActiveTab('audio');
                setCurrentPage(1);
                setPageInputValue('1');
              }}
            >
              Audio Files
            </button>
          </nav>

          <section className={styles.filesSection}>
            <div className={styles.filesSectionHeader}>
              <div className={styles.filesSectionControls}>
                <div className={styles.headerUpload}>
                  <h2>Your Files</h2>
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className={styles.uploadButton}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.uploadIcon}>
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                    Upload File
                  </button>
                </div>
                <div className={styles.searchBox}>
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1); // Reset to first page when searching
                    }}
                    className={styles.searchInput}
                  />
                </div>
              </div>
            </div>
            {filteredItems.length > 0 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => {
                    const newPage = Math.max(currentPage - 1, 1);
                    setCurrentPage(newPage);
                    setPageInputValue(newPage.toString());
                  }}
                  disabled={currentPage === 1}
                  className={styles.paginationButton}
                  title="Previous page"
                >
                  ‹
                </button>
                <input
                  type="number"
                  className={styles.pageInput}
                  value={pageInputValue || currentPage}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPageInputValue(value);
                    const pageNum = parseInt(value);
                    if (pageNum && pageNum > 0 && pageNum <= Math.ceil(filteredItems.length / itemsPerPage)) {
                      setCurrentPage(pageNum);
                    }
                  }}
                  onBlur={() => {
                    setPageInputValue(currentPage.toString());
                  }}
                  min={1}
                  max={Math.ceil(filteredItems.length / itemsPerPage)}
                  title="Enter page number"
                />
                <span className={styles.pageInfo}>/ {Math.ceil(filteredItems.length / itemsPerPage)}</span>
                <button
                  onClick={() => {
                    const newPage = Math.min(currentPage + 1, Math.ceil(filteredItems.length / itemsPerPage));
                    setCurrentPage(newPage);
                    setPageInputValue(newPage.toString());
                  }}
                  disabled={currentPage === Math.ceil(filteredItems.length / itemsPerPage)}
                  className={styles.paginationButton}
                  title="Next page"
                >
                  ›
                </button>
              </div>
            )}
            <div className={styles.filesGrid}>
              {isLoadingFiles ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner} />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className={styles.noFilesMessage}>
                  <div className={styles.emptyIcon}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z" />
                    </svg>
                  </div>
                  <p>{activeTab === 'audio' ? 'No audio files' : 'No text files'}</p>
                  <button onClick={() => setIsUploadModalOpen(true)}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className={styles.uploadIcon}>
                      <path d="M11 14.9V8.1c0-.5.4-.9.9-.9h.2c.5 0 .9.4.9.9v6.8c0 .5-.4.9-.9.9h-.2c-.5 0-.9-.4-.9-.9zm-4.5-2.4l3-3c.3-.3.7-.3 1 0l3 3c.3.3.3.7 0 1-.3.3-.7.3-1 0L11 12V19c0 .6-.4 1-1 1s-1-.4-1-1v-7l-1.5 1.5c-.3.3-.7.3-1 0-.3-.3-.3-.7 0-1z" />
                    </svg>
                    Upload File
                  </button>
                </div>
              ) : (
                filteredItems
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((item) => {
                    if (activeTab === 'audio') {
                      const audioItem = item as AudioFile;
                      return (
                        <div key={audioItem.audioId} className={`${styles.fileCard} ${styles.audioFileCard}`}>
                          <div className={styles.fileIcon}>
                            <AudioIcon />
                          </div>
                          <div className={styles.fileInfo}>
                            <h3>{audioItem.documentName.replace(/\.(txt|pdf|docx)$/, '')}</h3>
                            <div className={styles.fileMeta}>
                              <span>{audioItem.audioFileSizeMb.toFixed(2)} MB</span>
                              <span>{audioItem.language}</span>
                            </div>
                            <div className={styles.fileActions}>
                              <button
                                className={styles.viewButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAudioItem(audioItem);
                                  setIsViewingAudioDetails(true);
                                }}
                              >
                                View Details
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  try {
                                    const response = await fetch(audioItem.audioSignedUrl);
                                    const blob = await response.blob();
                                    const downloadUrl = window.URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = downloadUrl;
                                    link.download = `${audioItem.documentName.replace(/\.(txt|pdf|docx)$/, '')}.${audioItem.audioFormat}`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    window.URL.revokeObjectURL(downloadUrl);
                                  } catch (error) {
                                    console.error('Download failed:', error);
                                    toast.error('Failed to download file. Please try again.');
                                  }
                                }}
                                className={styles.generateButton}
                              >
                                Download
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      const text = item as CloudinaryText;
                      return (
                        <div
                          key={text.id}
                          className={styles.fileCard}
                          onClick={() => {
                            setSelectedText(text);
                            setIsEditingText(true);
                            setSelectedLanguage(text.language);
                            setSelectedGender(text.gender);
                            const matchingVoice = voices.find(v => v.name === text.voice);
                            if (matchingVoice) {
                              handleVoiceSelect(matchingVoice);
                            }
                            fetchTextContent(text.signedUrl);
                          }}
                        >
                          <div className={styles.fileIcon}>
                            {text.status === 'generating' ? (
                              <div className={styles.spinner} />
                            ) : (
                              <TextIcon />
                            )}
                          </div>
                          <div className={styles.fileInfo}>
                            <h3>{text.documentName.split('/').pop()?.replace('.txt', '')?.replace('.pdf', "")?.replace('docx', "")}</h3>
                            <div className={styles.fileMeta}>
                              <span>{formatSize(text.size)}</span>
                              <span>{text.language}</span>
                            </div>
                            <div className={styles.fileActions}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedText(text);
                                  setIsEditingText(true);
                                  setSelectedLanguage(text.language);
                                  setSelectedGender(text.gender);
                                  const matchingVoice = voices.find(v => v.name === text.voice);
                                  if (matchingVoice) {
                                    handleVoiceSelect(matchingVoice);
                                  }
                                  fetchTextContent(text.signedUrl);
                                }}
                                className={styles.viewButton}
                              >
                                Edit Voice
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerateMP3(text.id, text.size, text);
                                }}
                                className={styles.generateButton}
                                disabled={text.status === 'generating' || text.size > storage.available || downloadState.isProcessing}
                              >
                                {text.status === 'generating' ? 'Generating...' :
                                  text.size > storage.available ? 'Insufficient Transfer' :
                                    downloadState.isProcessing ? 'Processing Another File...' :
                                      'Generate MP3'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  }))}
            </div>
          </section>
        </div>

        <aside className={styles.sidebar}>
          <section className={styles.sidebarSection}>
            <h2>Account Settings</h2>
            <div className={styles.accountSection}>
              <button onClick={() => setIsChangingPassword(true)} className={styles.settingButton}>
                Change Password
              </button>
              <button className={styles.settingButton}>
                Manage Email Preferences
              </button>
            </div>
          </section>

          <section className={styles.sidebarSection}>
            <h2>Usage Statistics</h2>
            <div className={styles.usageSection}>
              <p>Available Transfer: {formatSize(storage.available)}</p>
              <div className={styles.usageBar}>
                <div
                  className={styles.usageProgress}
                  style={{ width: `${Math.min((storage.available / 1024) * 100, 100)}%` }}
                />
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Password Change Modal */}
      {
        isChangingPassword && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <h2>Change Password</h2>
              <form onSubmit={handleChangePassword}>
                <div className={styles.formGroup}>
                  <label>Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={e => setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value
                    })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={e => setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value
                    })}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={e => setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value
                    })}
                  />
                </div>
                <div className={styles.modalActions}>
                  <button type="submit" className={`${styles.button} ${styles.primaryButton}`}>
                    Change Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsChangingPassword(false)}
                    className={styles.button}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {
        isEditingText && selectedText && (
          <div className={styles.modal}>
            <div className={styles.modalContent}>
              <div className={styles.modalHeader}>
                <h2>Edit Voice Settings</h2>
                <button
                  onClick={() => {
                    stopSamplePlayback();
                    setIsEditingText(false);
                    setTextContent('');
                  }}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>

              <div className={styles.infoSection}>
                <div className={styles.infoText}>
                  After successful generation, the file will be:
                  <ul>
                    <li>Saved to your Audio Files tab</li>
                    <li>Deducted from your available transfer balance</li>
                  </ul>
                </div>
              </div>              <div className={styles.modalBody}>
                <div className={styles.voiceSettings}>
                  <div className={styles.settingGroup}>
                    <label>Language</label>
                    <select
                      value={selectedLanguage}
                      onChange={(e) => {
                        stopSamplePlayback();
                        handleLanguageChange(e.target.value);
                      }}
                    >
                      {languages.map((language) => (
                        <option key={language} value={language}>
                          {language}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.settingGroup}>
                    <label>Gender</label>
                    <select
                      value={selectedGender}
                      onChange={(e) => {
                        stopSamplePlayback();
                        handleGenderChange(e.target.value);
                      }}
                    >
                      {genders.map((gender) => (
                        <option key={gender} value={gender}>
                          {gender}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.settingGroup}>
                    <label>Voice</label>
                    <select
                      value={selectedVoice?.name || ''}
                      onChange={(e) => {
                        const selected = filteredVoices.find(voice => voice.name === e.target.value);
                        if (selected) handleVoiceSelect(selected);
                      }}
                    >
                      {filteredVoices.map((voice) => (
                        <option key={voice.name} value={voice.name}>
                          {`${voice.name} (${voice.gender})`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles.textArea}>
                  <div className={styles.textAreaHeader}>
                    <button
                      className={`${styles.playButton} ${isPreparing ? styles.preparing : ''}`}
                      onClick={() => {
                        if (selectedVoice && textContent) {
                          handleSampleButtonClick(textContent, selectedVoice);
                        }
                      }}
                      disabled={!selectedVoice || !textContent || isPreparing}
                    >
                      {isPreparing ? (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={styles.spinnerIcon}>
                            <circle cx="12" cy="12" r="10" strokeWidth="4" strokeDasharray="30 60" />
                          </svg>
                          Preparing...
                        </>
                      ) : isSamplePlaying ? (
                        <>
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                          </svg>
                          Stop Reading
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                          Read Text
                        </>
                      )}
                    </button>
                  </div>
                  {isLoadingContent ? (
                    <div className={styles.loadingContent}>Loading text content...</div>
                  ) : (
                    <div
                      className={styles.textContent}
                      style={{
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        msUserSelect: 'none',
                        cursor: 'default',
                        overflowY: 'auto',
                        height: '200px',
                        whiteSpace: 'pre-wrap',
                        padding: '8px'
                      }}
                    >
                      {textContent}
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  className={`${styles.button} ${styles.secondaryButton}`}
                  onClick={() => {
                    stopSamplePlayback();
                    setIsEditingText(false);
                    setTextContent('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className={`${styles.button} ${styles.primaryButton}`}
                  onClick={handleSaveChanges}
                  disabled={!selectedVoice}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

      {isUploadModalOpen && (
        <UploadModal
          onClose={() => {
            setIsUploadModalOpen(false);
            // Only refresh text files without affecting audio files
            instance.get<CloudinaryText[]>(`/files/with-urls`).then(response => {
              if (response.data) {
                setTexts(response.data.map(text => ({
                  ...text,
                  txtUrl: text.signedUrl,
                  documentName: text.documentName
                })));
              }
            });
          }}
          handleGenerateMP3={handleGenerateMP3}
        />
      )}
      <DownloadBar />

      {isViewingAudioDetails && selectedAudioItem && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2>Audio Details</h2>
              <button
                onClick={() => setIsViewingAudioDetails(false)}
                className={styles.closeButton}
              >
                ×
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.audioDetailsGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Duration: </span>
                  <span>
                    {Math.floor(selectedAudioItem.durationSeconds / 3600) > 0
                      ? `${Math.floor(selectedAudioItem.durationSeconds / 3600)}h ${Math.floor((selectedAudioItem.durationSeconds % 3600) / 60)}m`
                      : `${Math.floor(selectedAudioItem.durationSeconds / 60)}m ${selectedAudioItem.durationSeconds % 60}s`}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Size: </span>
                  <span>{selectedAudioItem.audioFileSizeMb.toFixed(2)} MB</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Format: </span>
                  <span>{selectedAudioItem.audioFormat.toUpperCase()}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Language: </span>
                  <span>{selectedAudioItem.language}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Voice: </span>
                  <span>{selectedAudioItem.voice}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Gender: </span>
                  <span>{selectedAudioItem.gender.charAt(0).toUpperCase() + selectedAudioItem.gender.slice(1).toLowerCase()}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.label}>Created: </span>
                  <span>{new Date(selectedAudioItem.audioCreatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={`${styles.button} ${styles.primaryButton}`}
                onClick={() => setIsViewingAudioDetails(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


