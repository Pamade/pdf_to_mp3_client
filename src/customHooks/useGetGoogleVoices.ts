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
            setVoices(response.data);
            const englishVoice = response.data.find((voice: GoogleVoice) =>
                voice.language.toLowerCase().includes('english')
            );

            if (englishVoice) {
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

    const filteredVoices = voices.filter(voice => {
        const matchesLanguage = !selectedLanguage || voice.language === selectedLanguage;
        const matchesGender = !selectedGender || voice.gender === selectedGender;
        return matchesLanguage && matchesGender;
    });

    const availableGenders = [...new Set(
        voices
            .filter(voice => !selectedLanguage || voice.language === selectedLanguage)
            .map(voice => voice.gender)
    )].sort();

    const availableLanguages = [...new Set(
        voices
            .filter(voice => !selectedGender || voice.gender === selectedGender)
            .map(voice => voice.language)
    )].sort();

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