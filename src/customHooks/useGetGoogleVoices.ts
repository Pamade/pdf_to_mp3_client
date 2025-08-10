import { useEffect, useState } from "react"
import { instanceNoAuth } from "../utils/axiosInstance"
import type { GoogleVoice } from "../types/voices"

export const useGetGoogleVoices = () => {
    const [voices, setVoices] = useState<GoogleVoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedLanguage, setSelectedLanguage] = useState<string>('');
    const [selectedGender, setSelectedGender] = useState<string>('');
    const [selectedVoice, setSelectedVoice] = useState<GoogleVoice | undefined>();

    const fetchVoices = async () => {
        try {
            const response = await instanceNoAuth.get('/google_voices/voices');
            console.log('Fetched voices:', response.data);
            setVoices(response.data);

            // Set default language to English if available
            const englishVoice = response.data.find((voice: GoogleVoice) =>
                voice.language.toLowerCase().includes('english')
            );

            if (englishVoice) {
                console.log('Selected English voice:', englishVoice);
                setSelectedLanguage(englishVoice.language);
                setSelectedGender(englishVoice.gender);
                !selectedVoice && handleVoiceSelect(englishVoice);
            }
        } catch (err) {
            setError('Failed to load Google voices');
            console.error('Error fetching voices:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVoices();
    }, []);

    // Get unique languages and sort them
    const languages = [...new Set(voices.map(voice => voice.language))].sort();

    // Get unique genders
    const genders = [...new Set(voices.map(voice => voice.gender))].sort();

    // Filter voices by selected language and gender
    const filteredVoices = voices.filter(voice => {
        const matchesLanguage = !selectedLanguage || voice.language === selectedLanguage;
        const matchesGender = !selectedGender || voice.gender === selectedGender;
        return matchesLanguage && matchesGender;
    });

    // Filter available genders based on selected language
    const availableGenders = [...new Set(
        voices
            .filter(voice => !selectedLanguage || voice.language === selectedLanguage)
            .map(voice => voice.gender)
    )].sort();

    // Filter available languages based on selected gender
    const availableLanguages = [...new Set(
        voices
            .filter(voice => !selectedGender || voice.gender === selectedGender)
            .map(voice => voice.language)
    )].sort();

    // Handle voice selection
    const handleVoiceSelect = (voice: GoogleVoice | null) => {
        setSelectedVoice(voice || undefined);
    };

    return {
        voices,
        loading,
        error,
        languages: availableLanguages,
        genders: availableGenders,
        filteredVoices,
        selectedLanguage,
        setSelectedLanguage,
        selectedGender,
        setSelectedGender,
        selectedVoice,
        handleVoiceSelect,
        fetchVoices
    };
}