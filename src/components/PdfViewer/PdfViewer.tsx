import React, { useState, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import styles from "./PdfViewer.module.scss";
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import toast from "react-hot-toast";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

interface PdfViewerProps {
    file: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
    const [numPages, setNumPages] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [screenWidth, setScreenWidth] = useState<number>(window.innerWidth);
    const [pdfText, setPdfText] = useState<string>("");
    const [isReading, setIsReading] = useState<boolean>(false);
    const [currentVoice, setCurrentVoice] = useState<string>("en-US-JennyNeural"); // Default voice
    const [playbackRate, setPlaybackRate] = useState<number>(1.0);

    const synthesizerRef = useRef<SpeechSDK.SpeechSynthesizer | null>(null);
    const cancelTokenRef = useRef<SpeechSDK.CancellationDetails | null>(null);

    // Azure Speech SDK key and region


    // Extract text from PDF
    const extractTextFromPDF = async (pdfUrl: string) => {
        try {
            const loadingTask = pdfjs.getDocument(pdfUrl);
            const pdf = await loadingTask.promise;
            let fullText = "";

            // Loop through each page and extract text
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(" ");
                fullText += pageText + " ";
            }

            setPdfText(fullText);
            return fullText;
        } catch (err) {
            console.error("Error extracting text from PDF:", err);
            toast.error("Failed to extract text from document");
            return "";
        }
    };

    // Initialize speech synthesizer
    const initSpeechSynthesizer = () => {
        try {
            const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
                speechKey,
                speechRegion
            );

            // Set the selected voice
            speechConfig.speechSynthesisVoiceName = currentVoice;

            // Set speech rate
            speechConfig.speechSynthesisOutputFormat = SpeechSDK.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

            const audioConfig = SpeechSDK.AudioConfig.fromDefaultSpeakerOutput();
            const synthesizer = new SpeechSDK.SpeechSynthesizer(speechConfig, audioConfig);

            synthesizerRef.current = synthesizer;
            return synthesizer;
        } catch (err) {
            console.error("Error initializing speech synthesizer:", err);
            toast.error("Failed to initialize speech service");
            return null;
        }
    };

    // Start reading the PDF
    const startReading = async () => {
        if (!file) return;

        try {
            // Extract text if not already available
            const textToRead = pdfText || await extractTextFromPDF(file);

            if (!textToRead) {
                toast.error("No text found in document");
                return;
            }

            // Initialize synthesizer
            const synthesizer = initSpeechSynthesizer();

            if (!synthesizer) return;

            // Set reading state
            setIsReading(true);

            // Create SSML with voice and rate
            const ssml = `
                <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
                    <voice name="${currentVoice}">
                        <prosody rate="${playbackRate}">
                            ${textToRead}
                        </prosody>
                    </voice>
                </speak>
            `;

            // Start speaking
            synthesizer.speakSsmlAsync(
                ssml,
                result => {
                    if (result) {
                        synthesizer.close();
                        synthesizerRef.current = null;
                        setIsReading(false);

                        if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
                            console.log("Speech synthesis completed");
                        } else {
                            console.error(`Speech synthesis canceled: ${result.errorDetails}`);
                        }
                    }
                },
                error => {
                    console.error(error);
                    synthesizer.close();
                    synthesizerRef.current = null;
                    setIsReading(false);
                    toast.error("Error during speech synthesis");
                }
            );
        } catch (err) {
            console.error("Error starting reading:", err);
            toast.error("Failed to start reading");
            setIsReading(false);
        }
    };

    // Pause and resume reading are not directly supported in this version of the SDK
    // Instead, we'll stop and restart from the beginning if needed

    // Stop reading
    const stopReading = () => {
        if (synthesizerRef.current) {
            try {
                synthesizerRef.current.close();
                synthesizerRef.current = null;
                setIsReading(false);
                console.log("Speech stopped");
            } catch (error) {
                console.error("Error stopping speech:", error);
            }
        }
    };

    // Change voice
    const changeVoice = (voiceName: string) => {
        setCurrentVoice(voiceName);
        // If currently reading, restart with new voice
        if (isReading) {
            stopReading();
            setTimeout(() => startReading(), 300);
        }
    };

    // Change playback rate
    const changePlaybackRate = (rate: number) => {
        setPlaybackRate(rate);
        // If currently reading, restart with new rate
        if (isReading) {
            stopReading();
            setTimeout(() => startReading(), 300);
        }
    };

    // Clean up when component unmounts
    useEffect(() => {
        return () => {
            if (synthesizerRef.current) {
                synthesizerRef.current.close();
            }
        };
    }, []);
    // Track screen width for responsive scaling
    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Extract text when PDF is loaded
    useEffect(() => {
        if (file) {
            extractTextFromPDF(file);
        }
    }, [file]);

    // Calculate appropriate scale based on screen width
    const getScale = (): number => {
        if (screenWidth < 480) {
            return 0.8; // Mobile
        } else if (screenWidth < 768) {
            return 1.0; // Tablet
        } else {
            return 1.2; // Desktop
        }
    };

    const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
    };

    const handleDocumentLoadError = (error: Error) => {
        console.error("Error loading PDF:", error);
        setError("Failed to load the document. Please try again.");
    };

    // Expose methods for parent component to call
    useEffect(() => {
        // Add methods to window for parent component to access
        (window as any).pdfViewerControls = {
            startReading,
            stopReading,
            changeVoice,
            changePlaybackRate,
            isReading: () => isReading
        };

        return () => {
            // Clean up when component unmounts
            delete (window as any).pdfViewerControls;
        };
    }, [isReading, pdfText]);

    return (
        <div className={styles.kindleWrapper}>
            <div className={styles.kindleContainer}>
                {error && (
                    <div className={styles.documentError}>
                        <p>{error}</p>
                    </div>
                )}

                <Document
                    file={file}
                    onLoadSuccess={handleDocumentLoadSuccess}
                    onLoadError={handleDocumentLoadError}
                    loading={null} // Hide default loading message
                >
                    {Array.from(new Array(numPages), (_, index) => (
                        <Page
                            key={`page_${index + 1}`}
                            pageNumber={index + 1}
                            scale={getScale()}
                            className={styles.kindlePage}
                            loading={null} // Hide default loading message
                            width={Math.min(screenWidth - 40, 700)} // Responsive width with max of 700px
                        />
                    ))}
                </Document>
            </div>
        </div>
    );
};

export default PdfViewer;
