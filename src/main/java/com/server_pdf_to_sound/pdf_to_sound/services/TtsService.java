package com.server_pdf_to_sound.pdf_to_sound.services;

import com.google.cloud.texttospeech.v1.*;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.io.IOException;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

@Service
@AllArgsConstructor
@Slf4j
public class TtsService {

    private static final int MAX_CHUNK_LENGTH = 1000; // Reduced for safety
    private static final Pattern SENTENCE_END_PATTERN = Pattern.compile("[.!?]+\\s+");
    private static final Pattern CLAUSE_END_PATTERN = Pattern.compile("[,;:]\\s+");

    public byte[] synthesize(String text, String languageCode, String voiceName) throws Exception {
        try (TextToSpeechClient textToSpeechClient = TextToSpeechClient.create()) {
            // Add periods at the end if missing
            if (!text.trim().endsWith(".") && !text.trim().endsWith("!") && !text.trim().endsWith("?")) {
                text = text.trim() + ".";
            }

            SynthesisInput input = SynthesisInput.newBuilder()
                    .setText(text)
                    .build();

            VoiceSelectionParams voice = VoiceSelectionParams.newBuilder()
                    .setLanguageCode(languageCode)
                    .setName(voiceName)
                    .build();

            AudioConfig audioConfig = AudioConfig.newBuilder()
                    .setAudioEncoding(AudioEncoding.MP3)
                    .build();

            SynthesizeSpeechResponse response = textToSpeechClient.synthesizeSpeech(input, voice, audioConfig);
            return response.getAudioContent().toByteArray();
        } catch (Exception e) {
            log.error("Error synthesizing speech: {}", e.getMessage());
            throw e;
        }
    }

    public List<String> splitTextIntoChunks(String text) {
        List<String> chunks = new ArrayList<>();
        
        // First, split by sentence endings
        String[] sentences = SENTENCE_END_PATTERN.split(text);
        StringBuilder currentChunk = new StringBuilder();

        for (String sentence : sentences) {
            // Ensure the sentence ends with proper punctuation
            String processedSentence = sentence.trim();
            if (!processedSentence.endsWith(".") && !processedSentence.endsWith("!") && !processedSentence.endsWith("?")) {
                processedSentence += ".";
            }

            if (currentChunk.length() + processedSentence.length() > MAX_CHUNK_LENGTH) {
                if (currentChunk.length() > 0) {
                    chunks.add(currentChunk.toString().trim());
                    currentChunk = new StringBuilder();
                }
                
                if (processedSentence.length() > MAX_CHUNK_LENGTH) {
                    // Split long sentence by clauses
                    chunks.addAll(splitLongSentence(processedSentence));
                } else {
                    currentChunk.append(processedSentence).append(" ");
                }
            } else {
                currentChunk.append(processedSentence).append(" ");
            }
        }

        if (currentChunk.length() > 0) {
            chunks.add(currentChunk.toString().trim());
        }

        return chunks;
    }

    private List<String> splitLongSentence(String sentence) {
        List<String> chunks = new ArrayList<>();
        
        // Split by clauses first
        String[] clauses = CLAUSE_END_PATTERN.split(sentence);
        StringBuilder currentChunk = new StringBuilder();

        for (String clause : clauses) {
            String processedClause = clause.trim();
            if (currentChunk.length() + processedClause.length() > MAX_CHUNK_LENGTH) {
                if (currentChunk.length() > 0) {
                    // Ensure chunk ends with punctuation
                    String chunk = currentChunk.toString().trim();
                    if (!chunk.endsWith(".") && !chunk.endsWith("!") && !chunk.endsWith("?")) {
                        chunk += ".";
                    }
                    chunks.add(chunk);
                    currentChunk = new StringBuilder();
                }
                
                if (processedClause.length() > MAX_CHUNK_LENGTH) {
                    chunks.addAll(splitByWords(processedClause));
                } else {
                    currentChunk.append(processedClause);
                }
            } else {
                if (currentChunk.length() > 0) {
                    currentChunk.append(", ");
                }
                currentChunk.append(processedClause);
            }
        }

        if (currentChunk.length() > 0) {
            String chunk = currentChunk.toString().trim();
            if (!chunk.endsWith(".") && !chunk.endsWith("!") && !chunk.endsWith("?")) {
                chunk += ".";
            }
            chunks.add(chunk);
        }

        return chunks;
    }

    private List<String> splitByWords(String text) {
        List<String> chunks = new ArrayList<>();
        String[] words = text.split("\\s+");
        StringBuilder currentChunk = new StringBuilder();

        for (String word : words) {
            if (currentChunk.length() + word.length() + 1 > MAX_CHUNK_LENGTH) {
                if (currentChunk.length() > 0) {
                    String chunk = currentChunk.toString().trim();
                    if (!chunk.endsWith(".") && !chunk.endsWith("!") && !chunk.endsWith("?")) {
                        chunk += ".";
                    }
                    chunks.add(chunk);
                    currentChunk = new StringBuilder();
                }
            }
            
            if (currentChunk.length() > 0) {
                currentChunk.append(" ");
            }
            currentChunk.append(word);
        }

        if (currentChunk.length() > 0) {
            String chunk = currentChunk.toString().trim();
            if (!chunk.endsWith(".") && !chunk.endsWith("!") && !chunk.endsWith("?")) {
                chunk += ".";
            }
            chunks.add(chunk);
        }

        return chunks;
    }

    public byte[] combineAudioChunks(List<byte[]> chunks) throws IOException {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        for (byte[] chunk : chunks) {
            outputStream.write(chunk);
        }
        return outputStream.toByteArray();
    }
} 