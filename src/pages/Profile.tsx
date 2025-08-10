import { useEffect, useState } from 'react';
import styles from './Profile.module.scss';
import { instance, instanceNoAuth } from '../utils/axiosInstance';
import { useGetGoogleVoices } from '../customHooks/useGetGoogleVoices';
import { usePlaySample } from '../customHooks/usePlaySample';

interface UserStorage {
  available: number; // in MB
}

interface CloudinaryText {
  id: number;
  documentName: string;
  txtUrl: string;
  size: number; // in MB
  gender: string;
  voice: string;
  language: string;
  status?: 'generating' | 'completed'; // Add status as optional
}

export function Profile() {
  const {
    languages,
    genders,
    filteredVoices,
    selectedLanguage,
    setSelectedLanguage,
    selectedGender,
    setSelectedGender,
    selectedVoice,
    handleVoiceSelect,
  } = useGetGoogleVoices();

  const {
    isSamplePlaying,
    isPreparing,
    handleSampleButtonClick,
    stopSamplePlayback
  } = usePlaySample();

  const [activeTab, setActiveTab] = useState<'all' | 'text' | 'audio'>('all');
  const [texts, setTexts] = useState<CloudinaryText[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(4);
  const [search, setSearch] = useState('');

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

  const filteredTexts = texts.filter(text => {
    const tabFilter = activeTab === 'all' ? true :
      activeTab === 'text' ? !text.status :
        text.status === 'completed' || text.status === 'generating';

    const searchFilter = search.trim() === '' ? true :
      text.documentName.toLowerCase().includes(search.toLowerCase()) ||
      text.language.toLowerCase().includes(search.toLowerCase());

    return tabFilter && searchFilter;
  });

  useEffect(() => {
    const getAvailableTransfer = async () => {
      try {
        const response = await instance.get<{ transfer: number }>('/available_transfer/get');
        console.log(response)
        setStorage(prev => ({
          ...prev,
          available: response.data.transfer
        }));
      } catch (error: any) {
        if (error.response?.status === 204) {
          setTexts([]);
        }
        console.error('Error fetching texts:', error);
      }
    };

    const getUserTexts = async () => {
      try {
        const response = await instance.get<CloudinaryText[]>('/cloudinary/text/get_all');
        setTexts(response.data);
        console.log(response.data)
      } catch (error: any) {
        if (error.response?.status === 204) {
          setTexts([]);
        }
        console.error('Error fetching texts:', error);
      }
    };
    getUserTexts();
    getAvailableTransfer();

  }, []);

  useEffect(() => {

    console.log(selectedVoice)
    // Automatically select the first voice when the language changes
    if (selectedLanguage && languageChanged) {
      const firstVoice = filteredVoices.find(voice => voice.language === selectedLanguage);
      if (firstVoice && firstVoice.name !== selectedVoice?.name) {
        handleVoiceSelect(firstVoice);
      }
      setLanguageChanged(false); // Reset the flag after selecting the voice
    }
  }, [selectedLanguage, filteredVoices, languageChanged]);

  useEffect(() => {
    // Automatically select the first voice when the gender changes
    if (selectedGender && genderChanged) {
      const firstVoice = filteredVoices.find(voice => voice.gender === selectedGender);
      if (firstVoice && firstVoice.name !== selectedVoice?.name) {
        handleVoiceSelect(firstVoice);
      }
      setGenderChanged(false); // Reset the flag after selecting the voice
    }
  }, [selectedGender, filteredVoices, genderChanged]);

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
      alert('Not enough available transfer. Please purchase more.');
      return;
    }

    try {

      setTexts(texts.map(t =>
        t.id === textId ? { ...t, status: 'generating' } : t
      ));

      let actualTextContent = '';

      try {
        const textResponse = await fetch(text.txtUrl);
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

        // Zamiast Buffer.byteLength, używamy TextEncoder
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

      const textChunks = splitTextIntoChunks(actualTextContent, 899); // 2000 bytes per chunk

      for (let i = 0; i < textChunks.length; i++) {
        try {
          const chunkResponse = await instanceNoAuth.post('/tts/synthesize-chunk', {
            text: textChunks[i],
            chunkIndex: i,
            languageCode: text.voice.slice(0, 5),
            voiceName: text.voice
          }, {
            responseType: "arraybuffer"
          }
          );

          const base64Audio = arrayBufferToBase64(chunkResponse.data);
          audioChunks.push(base64Audio);
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

      const file = new File([audioBlob], `${selectedText?.documentName.split('/').pop()?.replace('.txt', '')}.mp3`, {
        type: 'audio/mpeg'
      });

      const downloadUrl = URL.createObjectURL(audioBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = `${selectedText?.documentName.split('/').pop()?.replace('.txt', '')}.mp3`;
      downloadLink.click();

      const formData = new FormData();
      formData.append('file', file);

      instance.post(`/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setTexts(texts.map(t =>
        t.id === textId ? { ...t, status: 'completed' } : t
      ));

      alert('MP3 generated successfully!');

    } catch (error) {

      setTexts(texts.map(t =>
        t.id === textId ? { ...t, status: undefined } : t
      ));

      if (error) {
      } else {
      }
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

  const handleSaveChanges = async () => {
    if (!selectedText || !selectedVoice) return;

    try {
      stopSamplePlayback();
      const response = await instance.patch(`/cloudinary/text/update/${selectedText.id}`, {
        language: selectedLanguage,
        languageCode: selectedVoice.language_code, // Add languageCode from selected voice
        gender: selectedGender,
        voice: selectedVoice.name || "",
      });

      // Update the texts array with the new values
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
              className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Files
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'text' ? styles.active : ''}`}
              onClick={() => setActiveTab('text')}
            >
              Text Files
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'audio' ? styles.active : ''}`}
              onClick={() => setActiveTab('audio')}
            >
              Audio Files
            </button>
          </nav>

          <section className={styles.filesSection}>
            <div className={styles.filesSectionHeader}>
              <div className={styles.filesSectionControls}>
                <h2>Your Files</h2>
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
            {filteredTexts.length > 0 && (
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
                    if (pageNum && pageNum > 0 && pageNum <= Math.ceil(filteredTexts.length / itemsPerPage)) {
                      setCurrentPage(pageNum);
                    }
                  }}
                  onBlur={() => {
                    setPageInputValue(currentPage.toString());
                  }}
                  min={1}
                  max={Math.ceil(filteredTexts.length / itemsPerPage)}
                  title="Enter page number"
                />
                <span className={styles.pageInfo}>/ {Math.ceil(filteredTexts.length / itemsPerPage)}</span>
                <button
                  onClick={() => {
                    const newPage = Math.min(currentPage + 1, Math.ceil(filteredTexts.length / itemsPerPage));
                    setCurrentPage(newPage);
                    setPageInputValue(newPage.toString());
                  }}
                  disabled={currentPage === Math.ceil(filteredTexts.length / itemsPerPage)}
                  className={styles.paginationButton}
                  title="Next page"
                >
                  ›
                </button>
              </div>
            )}
            <div className={styles.filesGrid}>
              {filteredTexts
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((text) => (
                  <div
                    key={text.id}
                    className={styles.fileCard}
                    onClick={() => {
                      setSelectedText(text);
                      setIsEditingText(true);
                      setSelectedLanguage(text.language);
                      setSelectedGender(text.gender);
                      const matchingVoice = filteredVoices.find(v => v.name === text.voice);
                      if (matchingVoice) handleVoiceSelect(matchingVoice);
                      fetchTextContent(text.txtUrl);
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
                            const matchingVoice = filteredVoices.find(v => v.name === text.voice);
                            if (matchingVoice) handleVoiceSelect(matchingVoice);
                          }}
                          className={styles.viewButton}
                        >
                          Edit Text & Voice
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateMP3(text.id, text.size, text);
                          }}
                          className={styles.generateButton}
                          disabled={text.status === 'generating' || text.size > storage.available}
                        >
                          {text.status === 'generating' ? 'Generating...' :
                            text.size > storage.available ? 'Insufficient Transfer' :
                              'Generate MP3'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
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
                <h2>Edit</h2>
                <button
                  onClick={() => {
                    stopSamplePlayback();
                    setIsEditingText(false);
                  }}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>

              <div className={styles.modalBody}>
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
                  }}
                >
                  Cancel
                </button>
                <button
                  className={`${styles.button} ${styles.primaryButton}`}
                  onClick={handleSaveChanges}
                  disabled={!selectedVoice} // Disable if no voice is selected
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}


