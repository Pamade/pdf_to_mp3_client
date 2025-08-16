import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './UploadModal.module.scss';
import { useGetGoogleVoices } from '../../customHooks/useGetGoogleVoices';
import { usePlaySample } from '../../customHooks/usePlaySample';
import { instance } from '../../utils/axiosInstance';
import toast from 'react-hot-toast';
import { extractTextFromPDF } from '../../utils/pdfUtils';

interface UploadModalProps {
    onClose: () => void;
    handleGenerateMP3: (textId: number, fileSize: number, text: any) => Promise<void>;
    isGenerating?: boolean;
    transfer: number;
}

export function UploadModal({ onClose, handleGenerateMP3, isGenerating = false, transfer }: UploadModalProps) {
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

    const [languageChanged, setLanguageChanged] = useState(false);
    const [genderChanged, setGenderChanged] = useState(false);



    // Handle voice selection when language changes
    useEffect(() => {
        if (selectedLanguage && languageChanged) {
            const firstVoice = filteredVoices.find(voice => voice.language === selectedLanguage);
            if (firstVoice && firstVoice.name !== selectedVoice?.name) {
                handleVoiceSelect(firstVoice);
            }
            setLanguageChanged(false);
        }
    }, [selectedLanguage, filteredVoices, languageChanged]);

    // Handle voice selection when gender changes
    useEffect(() => {
        if (selectedGender && genderChanged) {
            const firstVoice = filteredVoices.find(voice => voice.gender === selectedGender);
            if (firstVoice && firstVoice.name !== selectedVoice?.name) {
                handleVoiceSelect(firstVoice);
            }
            setGenderChanged(false);
        }
    }, [selectedGender, filteredVoices, genderChanged]);

    const {
        isSamplePlaying,
        isPreparing,
        handleSampleButtonClick,
        stopSamplePlayback
    } = usePlaySample();

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileContent, setFileContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        stopSamplePlayback();
        setIsLoading(true);
        setSelectedFile(file);

        // Calculate file size in MB
        try {
            if (file.type === 'text/plain') {
                // Handle text files
                const content = await file.text();
                setFileContent(content.trim());
            } else if (file.type === 'application/pdf') {
                // Handle PDF files using the existing extractTextFromPDF function
                const pages = await extractTextFromPDF(file);
                const allText = pages.map(page => page.text).join('\n\n');
                setFileContent(allText);
            } else {
                setFileContent('This file type is not supported yet.');
            }
        } catch (error) {
            console.error('Error reading file:', error);
            toast.error('Error reading file');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedFile || !selectedVoice || !fileContent) return;

        // Create a text file from the extracted content
        const blob = new Blob([fileContent], { type: "text/plain" });
        const textFile = new File([blob], `${selectedFile.name.split('.')[0]}.txt`, { type: "text/plain" });

        // Calculate file size in MB before upload
        const fileSizeInMB = selectedFile.size / (1024 * 1024);

        if (fileSizeInMB === 0) {
            toast.error('File appears to be empty. Please choose another file.');
            return;
        }

        try {
            // Create FormData with all necessary information
            const formData = new FormData();
            formData.append("file", textFile);
            formData.append("language", selectedLanguage);
            formData.append("gender", selectedGender);
            formData.append("voice", selectedVoice.name);
            formData.append("originalFileSize", String(textFile.size));

            console.log(formData)
            // First, upload the file
            const uploadResponse = await instance.post("/files/upload", formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (uploadResponse.data) {
                console.log('Upload response:', uploadResponse.data);

                const responseData = uploadResponse.data;
                onClose();

                await handleGenerateMP3(
                    responseData.id,
                    fileSizeInMB,
                    {
                        id: responseData.id,
                        documentName: responseData.documentName,
                        filename: responseData.filename,
                        publicId: responseData.publicId,
                        signedUrl: responseData.signedUrl,
                        size: responseData.size,
                        gender: responseData.gender,
                        voice: responseData.voice,
                        language: responseData.language,
                        uploadedAt: responseData.uploadedAt,
                        status: 'generating'
                    }
                );
            }
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload file. Please try again.');
        }
    }; return (
        <div className={styles.modal}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2>Upload</h2>
                    <button onClick={() => {
                        stopSamplePlayback();
                        onClose();
                    }} className={styles.closeButton}>×</button>
                </div>

                <div className={styles.infoSection}>
                    <div className={styles.infoText}>
                        After successful generation, the file will be:
                        <ul>
                            <li>Automatically downloaded to your computer</li>
                            <li>Sent to your email account as backup</li>
                            <li>Transfer will be taken from your available balance</li>
                        </ul>
                    </div>
                </div>

                <div className={styles.modalBody}>
                    <div className={styles.uploadSection}>
                        <input
                            type="file"
                            accept=".txt,.pdf,.docx"
                            onChange={handleFileChange}
                            className={styles.fileInput}
                        />
                        {selectedFile && (
                            <div>
                                <p className={styles.fileName}>Selected: {selectedFile.name}</p>
                                <p className={`${styles.fileSize} ${selectedFile.size / (1024 * 1024) > transfer ? styles.insufficientTransfer : ''}`}>
                                    Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)}MB
                                    {selectedFile.size / (1024 * 1024) > transfer && ' (Exceeds available transfer)'}
                                </p>
                            </div>
                        )}
                        {isLoading && (
                            <div className={styles.loading}>
                                Generating...
                            </div>
                        )}
                    </div>

                    <div className={styles.voiceSettings}>
                        <div className={styles.settingGroup}>
                            <label>Language</label>
                            <select
                                value={selectedLanguage}
                                onChange={(e) => {
                                    stopSamplePlayback();
                                    setSelectedLanguage(e.target.value);
                                    setLanguageChanged(true);
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
                                    setSelectedGender(e.target.value);
                                    setGenderChanged(true);
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
                                    stopSamplePlayback();
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

                    {fileContent && (
                        <div className={styles.textPreview}>
                            <div className={styles.textAreaHeader}>
                                <button
                                    className={`${styles.playButton} ${isPreparing ? styles.preparing : ''}`}
                                    onClick={() => {
                                        if (isSamplePlaying) {
                                            stopSamplePlayback();
                                        } else if (selectedVoice && fileContent) {
                                            handleSampleButtonClick(fileContent.slice(0, 500), selectedVoice);
                                        }
                                    }}
                                    disabled={!selectedVoice || !fileContent || isPreparing || isGenerating}
                                >
                                    {isPreparing ? (
                                        'Preparing...'
                                    ) : isSamplePlaying ? (
                                        'Reading...'
                                    ) : (
                                        'Read Preview'
                                    )}
                                </button>
                            </div>
                            <div className={styles.textContent} style={{
                                overflowX: 'hidden',
                                whiteSpace: 'pre-wrap',
                                wordWrap: 'break-word'
                            }}>
                                {fileContent}
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.modalFooter}>
                    <button
                        className={`${styles.button} ${styles.secondaryButton}`}
                        onClick={() => {
                            stopSamplePlayback();
                            onClose();
                        }}
                    >
                        Cancel
                    </button>
                    {selectedFile ? (
                        selectedFile.size / (1024 * 1024) <= transfer ? (
                            <button
                                className={`${styles.button} ${styles.primaryButton}`}
                                onClick={handleSubmit}
                                disabled={!selectedFile || !selectedVoice || isGenerating}
                            >
                                {isGenerating ? 'Processing...' : 'Upload and Generate'}
                            </button>
                        ) : (
                            <Link
                                to="/pricing"
                                className={`${styles.button} ${styles.primaryButton} ${styles.insufficientTransfer}`}
                            >
                                INSUFFICIENT TRANSFER ({(selectedFile.size / (1024 * 1024)).toFixed(2)}MB needed)
                            </Link>
                        )
                    ) : (
                        <button
                            className={`${styles.button} ${styles.primaryButton}`}
                            disabled={true}
                        >
                            Select a file to continue
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
