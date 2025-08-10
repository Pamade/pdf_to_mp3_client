import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { instance, instanceNoAuth } from '../utils/axiosInstance';
import styles from './Success.module.scss';

interface GenerationProgress {
  currentChunk: number;
  totalChunks: number;
  status: string;
}

export function Success() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);

  useEffect(() => {
    const startGeneration = async () => {
      const sessionId = new URLSearchParams(location.search).get('session_id');
      
      if (!sessionId) {
        setError('Invalid session ID');
        setIsLoading(false);
        return;
      }

      try {
        // Check if we have a token
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Please log in to continue');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

        // Verify the payment session first
        console.log('Verifying session:', sessionId);
        const sessionResponse = await instance.get(`/stripe/verify-session/${sessionId}`);
        console.log('Session response:', sessionResponse.data);
        const { text, voiceSettings } = {"text": "ASDFASDFASDFASDF", "voiceSettings": {"languageCode": "en", "voiceName": "en-US-Standard-A"}};
        
        if (!text || !voiceSettings) {
          console.error('Missing data from session:', { text, voiceSettings });
          setError('Invalid session data received');
          return;
        }

        if (!voiceSettings.languageCode || !voiceSettings.voiceName) {
          console.error('Missing voice settings:', voiceSettings);
          setError('Invalid voice settings received');
          return;
        }

        setGenerationProgress({
          currentChunk: 0,
          totalChunks: 0,
          status: 'Starting generation...'
        });

        // Initialize generation and get total chunks
        console.log('Initializing TTS with:', { text, voiceSettings });
        const initResponse = await instanceNoAuth.post('/tts/init', { 
          text,
          languageCode: voiceSettings.languageCode,
          voiceName: voiceSettings.voiceName
        });
        console.log('Init response:', initResponse.data);
        const { totalChunks } = initResponse.data;

        if (!totalChunks || totalChunks <= 0) {
          console.error('Invalid chunks count:', totalChunks);
          setError('Failed to initialize text processing');
          return;
        }

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

          console.log(`Generating chunk ${i + 1}/${totalChunks}`);
          const response = await instanceNoAuth.post('/tts/synthesize-chunk', {
            text,
            chunkIndex: i,
            languageCode: voiceSettings.languageCode,
            voiceName: voiceSettings.voiceName
          }, {
            responseType: 'arraybuffer'
          });
          
          if (!response.data || response.data.byteLength === 0) {
            console.error(`Empty response for chunk ${i + 1}`);
            setError(`Failed to generate audio chunk ${i + 1}`);
            return;
          }

          audioChunks.push(response.data);
        }

        if (audioChunks.length === 0) {
          console.error('No audio chunks generated');
          setError('Failed to generate audio content');
          return;
        }

        // Combine chunks
        setGenerationProgress({
          currentChunk: totalChunks,
          totalChunks,
          status: 'Finalizing audio...'
        });

        // Convert ArrayBuffer to base64 strings for JSON serialization
        console.log('Converting chunks to base64');
        const base64Chunks = audioChunks.map(buffer => {
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          return window.btoa(binary);
        });

        console.log('Combining audio chunks');
        const finalResponse = await instanceNoAuth.post('/tts/combine-chunks', {
          chunks: base64Chunks
        }, {
          responseType: 'arraybuffer'
        });

        if (!finalResponse.data || finalResponse.data.byteLength === 0) {
          console.error('Empty final response');
          setError('Failed to combine audio chunks');
          return;
        }

        // Create and download the file
        console.log('Creating final audio file');
        const blob = new Blob([finalResponse.data], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'generated-audio.mp3';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setGenerationProgress({
          currentChunk: totalChunks,
          totalChunks,
          status: 'Generation complete!'
        });
      } catch (err) {
        console.error('Error during generation:', err);
        if (err instanceof Error) {
          if (err.message === 'Authentication required') {
            setError('Please log in to continue');
            setTimeout(() => navigate('/login'), 2000);
          } else {
            console.error('Error details:', {
              message: err.message,
              stack: err.stack,
              name: err.name
            });
            setError(`Generation failed: ${err.message}`);
          }
        } else {
          console.error('Unknown error type:', err);
          setError('Failed to generate audio file');
        }
      } finally {
        setIsLoading(false);
      }
    };
    //make sessions!
    startGeneration();
  }, [location.search, navigate]);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Payment Successful!</h1>
          <p>Thank you for your purchase. Your file is being generated.</p>
        </div>

        {error ? (
          <div className={styles.error}>
            <span className={styles.errorIcon}>⚠️</span>
            {error}
          </div>
        ) : (
          <div className={styles.content}>
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
          </div>
        )}
      </div>
    </div>
  );
} 