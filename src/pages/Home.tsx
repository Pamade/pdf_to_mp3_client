import { useEffect, useState } from 'react';
import { PDFUploader } from '../components/PDFUploader/PDFUploader';
import { GoogleVoiceSelector } from '../components/GoogleVoiceSelector/GoogleVoiceSelector';
import { instanceNoAuth, instance } from '../utils/axiosInstance';
import { formatFileSize, calculatePrice } from '../utils/fileUtils';
import styles from './Home.module.scss';
import { Link } from 'react-router-dom';

interface PDFPage {
  pageNumber: number;
  text: string;
}

interface GenerationProgress {
  currentChunk: number;
  totalChunks: number;
  status: string;
}

interface GoogleVoice {
  name: string;
  language: string;
  gender: string;
  language_code: string;
}

function downloadMP3FromBlob(audioBlob: Blob) {
  const url = URL.createObjectURL(audioBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tts-audio.mp3';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function Home() {
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [fullText, setFullText] = useState<string>('');
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [editedText, setEditedText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<GoogleVoice>();
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [fileSize, setFileSize] = useState<string>('');
  const [price, setPrice] = useState<number | null>(null);
  const [isShowingAuthModal, setIsShowingAuthModal] = useState(false);

  useEffect(() => {
    setFullText(pages.map(page => page.text).join('\n\n'));
  }, [editedText]);

  const handleTextExtracted = (pages: PDFPage[], file: File) => {
    setPages(pages);
    setCurrentFile(file);
    setFileSize(formatFileSize(file.size));
    setPrice(calculatePrice(file.size));
    if (pages.length > 0) {
      setSelectedPage(1);
      setEditedText(pages[0].text);
    }
  };

  const handlePageChange = (pageNumber: number) => {
    setSelectedPage(pageNumber);
    const pageText = pages.find(p => p.pageNumber === pageNumber)?.text || '';
    setEditedText(pageText);
    setAudioUrl('');
  };


  const handleGenerateAudio = async () => {
    if (!selectedVoice) {
      alert('Please select a voice first');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(null);

    try {
      const allText = pages
        .map(page => page.text)
        .join('\n\n');

      // Initialize generation and get total chunks
      const initResponse = await instanceNoAuth.post('/tts/init', {
        text: allText,
        languageCode: selectedVoice.language_code,
        voiceName: selectedVoice.name
      });
      const { totalChunks } = initResponse.data;

      setGenerationProgress({
        currentChunk: 0,
        totalChunks,
        status: 'Starting generation...'
      });

      // Generate audio chunks
      const audioChunks: ArrayBuffer[] = [];
      for (let i = 0; i < totalChunks; i++) {
        setGenerationProgress({
          currentChunk: i + 1,
          totalChunks,
          status: `Generating chunk ${i + 1} of ${totalChunks}...`
        });

        const response = await instanceNoAuth.post('/tts/synthesize-chunk', {
          text: allText,
          chunkIndex: i,
          languageCode: selectedVoice.language_code,
          voiceName: selectedVoice.name
        }, {
          responseType: 'arraybuffer'
        });
        audioChunks.push(response.data);
      }

      // Combine chunks
      setGenerationProgress({
        currentChunk: totalChunks,
        totalChunks,
        status: 'Finalizing audio...'
      });

      // Convert ArrayBuffer to base64 strings for JSON serialization
      const base64Chunks = audioChunks.map(buffer => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      });

      const finalResponse = await instanceNoAuth.post('/tts/combine-chunks', {
        chunks: base64Chunks
      }, {
        responseType: 'arraybuffer'
      });

      const blob = new Blob([finalResponse.data], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(blob);
      setAudioUrl(audioUrl);
      downloadMP3FromBlob(blob);

      setGenerationProgress({
        currentChunk: totalChunks,
        totalChunks,
        status: 'Generation complete!'
      });
    } catch (error) {
      console.error('Error generating audio:', error);
      setGenerationProgress({
        currentChunk: 0,
        totalChunks: 0,
        status: 'Error generating audio'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Future of Document Voice Synthesis</h1>
        <p>Try our AI voices for free - upload your document and start listening. Create an account to generate and download MP3s.</p>
      </header>

      <div className={styles.featuresSection}>
        <div className={styles.featureCard}>
          <svg className={styles.featureIcon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2zm0-2h2V7h-2z" />
          </svg>
          <h3>Advanced AI Voices</h3>
          <p>Choose from a wide range of natural-sounding voices in multiple languages and accents.</p>
        </div>
        <div className={styles.featureCard}>
          <svg className={styles.featureIcon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
            <path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z" />
          </svg>
          <h3>Real-time Processing</h3>
          <p>Convert your documents to audio in minutes with our high-speed processing engine.</p>
        </div>
        <div className={styles.featureCard}>
          <svg className={styles.featureIcon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
          </svg>
          <h3>Enterprise Security</h3>
          <p>Your documents are protected with enterprise-grade encryption and secure processing.</p>
        </div>
      </div>

      <div className={styles.testimonialSection}>
        <h2>What Our Users Say</h2>
        <div className={styles.testimonialGrid}>
          <div className={styles.testimonialCard}>
            <p className={styles.quote}>"This tool has revolutionized how we create audio content. The voice quality is incredible."</p>
            <p className={styles.author}>Sarah Johnson</p>
            <p className={styles.role}>Content Director</p>
          </div>
          <div className={styles.testimonialCard}>
            <p className={styles.quote}>"We've reduced our audio production time by 90% using this platform. It's a game-changer."</p>
            <p className={styles.author}>Michael Chen</p>
            <p className={styles.role}>Digital Producer</p>
          </div>
        </div>
      </div>

      <div className={styles.ctaSection}>
        <h2>Try Our Voice Synthesis Now</h2>
        <p>Upload your document and preview the voice. Create an account to generate MP3.</p>
        <div className={styles.ctaFeatures}>
          <div className={styles.ctaFeature}>
            <svg className={styles.ctaIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-4h2v2h-2zm0-2h2V7h-2z" />
            </svg>
            <span>Upload & Preview</span>
          </div>
          <div className={styles.ctaFeature}>
            <svg className={styles.ctaIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
            </svg>
            <span>Choose Voice</span>
          </div>
          <div className={styles.ctaFeature}>
            <svg className={styles.ctaIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
            </svg>
            <span>Generate MP3</span>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.card}>
          <PDFUploader onTextExtracted={handleTextExtracted} />
        </div>

        {pages.length > 0 && (
          <div className={styles.pdfContent}>
            <div className={styles.pageNavigation}>
              <button
                onClick={() => handlePageChange(selectedPage - 1)}
                disabled={selectedPage === 1}
                className={styles.pageButton}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={styles.buttonIcon}
                >
                  <path
                    d="M15 19l-7-7 7-7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className={styles.pageInfo}>
                <input
                  type="number"
                  min={1}
                  max={pages.length}
                  value={selectedPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value);
                    if (page >= 1 && page <= pages.length) {
                      handlePageChange(page);
                    }
                  }}
                  className={styles.pageInput}
                />
                <span className={styles.pageDivider}>/</span>
                <span className={styles.totalPages}>{pages.length}</span>
              </div>
              <button
                onClick={() => handlePageChange(selectedPage + 1)}
                disabled={selectedPage === pages.length}
                className={styles.pageButton}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={styles.buttonIcon}
                >
                  <path
                    d="M9 5l7 7-7 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <div className={styles.textEditor}>
              <textarea
                value={editedText}
                readOnly
                className={styles.editableTextArea}
                placeholder="Page content will appear here..."
              />
            </div>

            {currentFile && (
              <div className={styles.fileInfoSimple}>
                <p className={styles.fileName}>{currentFile.name}</p>
                <p className={styles.fileSize}>Size: {fileSize}</p>
                {price && <p className={styles.price}>Price: {price.toFixed(2)} EUR</p>}
              </div>
            )}

            <div className={styles.controls}>
              <GoogleVoiceSelector
                fullText={fullText}
                setFullText={setFullText}
                onVoiceSelect={setSelectedVoice}
                selectedVoice={selectedVoice}
                currentPageText={editedText}
                onGenerateFullPDF={handleGenerateAudio}
                isGenerating={isGenerating}
                fileInfo={currentFile && price ? {
                  fileName: currentFile.name,
                  fileSize: fileSize,
                  fileSizeInBytes: currentFile.size
                } : undefined}
              />

              <div className={styles.audioControls}>
                {generationProgress && (
                  <div className={styles.progressContainer}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{
                          width: `${(generationProgress.currentChunk / generationProgress.totalChunks) * 100}%`
                        }}
                      />
                    </div>
                    <div className={styles.progressText}>
                      {generationProgress.status}
                    </div>
                  </div>
                )}
                {audioUrl && (
                  <div className={styles.audioPlayer}>
                    <audio
                      src={audioUrl}
                      controls
                      className={styles.audio}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isShowingAuthModal && (
        <div className={styles.authModal}>
          <div className={styles.authModalContent}>
            <button className={styles.closeModal} onClick={() => setIsShowingAuthModal(false)}>×</button>
            <svg className={styles.lockIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
            </svg>
            <h2>Create Account to Generate MP3</h2>
            <p>Unlock full access to generate and download MP3 files of your documents.</p>
            <div className={styles.authButtons}>
              <Link to="/register" className={styles.primaryButton}>Create Free Account</Link>
              <Link to="/login" className={styles.secondaryButton}>Sign In</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}