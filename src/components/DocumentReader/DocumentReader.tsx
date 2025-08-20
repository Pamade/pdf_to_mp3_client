// DocumentReader.tsx
import React, { useEffect, useRef, useState } from "react";
import * as mammoth from "mammoth";
import styles from "./DocumentReader.module.scss";

interface DocumentReaderProps {
    file: File;
}

const DocumentReader: React.FC<DocumentReaderProps> = ({ file }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [htmlContent, setHtmlContent] = useState<string>("");

    useEffect(() => {
        if (!file) return;

        setIsLoading(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;

                // Use mammoth to convert DOCX to HTML
                const result = await mammoth.convertToHtml(
                    { arrayBuffer },
                    {
                        // Better image handling
                        convertImage: mammoth.images.imgElement(function (image) {
                            return image.read("base64").then(function (imageBuffer) {
                                return {
                                    src: "data:" + image.contentType + ";base64," + imageBuffer
                                };
                            });
                        }),
                        // Include default style mappings
                        includeDefaultStyleMap: true,
                        // Custom style mappings for better formatting
                        styleMap: [
                            "p[style-name='Heading 1'] => h1:fresh",
                            "p[style-name='Heading 2'] => h2:fresh",
                            "p[style-name='Heading 3'] => h3:fresh",
                            "p[style-name='Title'] => h1.title:fresh",
                            "r[style-name='Strong'] => strong"
                        ]
                    }
                );

                setHtmlContent(result.value);

                // Log any warnings
                if (result.messages.length > 0) {
                    console.warn('Mammoth conversion warnings:', result.messages);
                }

            } catch (err) {
                console.error('Error loading document:', err);
                setError('Błąd podczas ładowania dokumentu. Sprawdź czy plik nie jest uszkodzony.');
            } finally {
                setIsLoading(false);
            }
        };

        reader.onerror = () => {
            setError('Błąd podczas odczytu pliku');
            setIsLoading(false);
        };

        reader.readAsArrayBuffer(file);
    }, [file]);

    // Create pages after HTML content is set
    useEffect(() => {
        if (!htmlContent || !containerRef.current || isLoading) return;

        createPages();
    }, [htmlContent, isLoading]);

    const createPages = () => {
        if (!containerRef.current || !htmlContent) return;

        // Clear container
        containerRef.current.innerHTML = '';

        // Create a temporary container to measure content
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = htmlContent;
        tempContainer.style.position = 'absolute';
        tempContainer.style.visibility = 'hidden';
        tempContainer.style.width = window.innerWidth <= 768 ? 'calc(100vw - 30px)' : '650px';
        tempContainer.style.top = '-9999px';
        tempContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif';
        tempContainer.style.fontSize = window.innerWidth <= 768 ? '10pt' : '11pt';
        tempContainer.style.lineHeight = '1.15';
        document.body.appendChild(tempContainer);

        // Get all paragraphs and elements
        const elements = Array.from(tempContainer.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, table, img, div'));

        document.body.removeChild(tempContainer);

        if (elements.length === 0) {
            // Fallback: create single page with all content
            const page = document.createElement('div');
            page.className = styles.page;
            page.innerHTML = htmlContent;
            containerRef.current.appendChild(page);
            setTotalPages(1);
            return;
        }

        let currentPage = document.createElement('div');
        currentPage.className = styles.page;

        const maxPageHeight = window.innerWidth <= 768 ? 700 : 950;
        let currentHeight = 0;
        let pageCount = 0;

        const addPage = () => {
            if (currentPage.children.length > 0) {
                containerRef.current!.appendChild(currentPage);
                pageCount++;
            }
            currentPage = document.createElement('div');
            currentPage.className = styles.page;
            currentHeight = 0;
        };

        elements.forEach((element, index) => {
            // Clone the element
            const clone = element.cloneNode(true) as HTMLElement;

            // Estimate element height (rough calculation)
            let estimatedHeight = 0;
            if (element.tagName === 'P') {
                estimatedHeight = Math.max(20, element.textContent?.length || 0) / 10;
            } else if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)) {
                estimatedHeight = 30;
            } else if (element.tagName === 'IMG') {
                estimatedHeight = 200; // Default image height
            } else if (element.tagName === 'TABLE') {
                const rows = element.querySelectorAll('tr');
                estimatedHeight = rows.length * 25;
            } else {
                estimatedHeight = 20;
            }

            // Check if adding this element would exceed page height
            if (currentHeight + estimatedHeight > maxPageHeight && currentPage.children.length > 0) {
                addPage();
            }

            currentPage.appendChild(clone);
            currentHeight += estimatedHeight;

            // If this is the last element, add the page
            if (index === elements.length - 1) {
                addPage();
            }
        });

        // Ensure we have at least one page
        if (pageCount === 0) {
            const page = document.createElement('div');
            page.className = styles.page;
            page.innerHTML = htmlContent;
            containerRef.current.appendChild(page);
            pageCount = 1;
        }

        setTotalPages(pageCount);
    };

    // Scroll handler for page tracking
    useEffect(() => {
        const wrapper = scrollRef.current;
        if (!wrapper || isLoading || totalPages === 0) return;

        const handleScroll = () => {
            if (!containerRef.current) return;

            const pages = containerRef.current.querySelectorAll(`.${styles.page}`);
            if (!pages || pages.length === 0) return;

            const scrollTop = wrapper.scrollTop;
            const wrapperHeight = wrapper.clientHeight;
            const scrollCenter = scrollTop + wrapperHeight / 2;

            let newCurrentPage = 1;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i] as HTMLElement;
                const pageTop = page.offsetTop - wrapper.offsetTop + 20; // account for container padding
                const pageBottom = pageTop + page.offsetHeight;

                if (scrollCenter >= pageTop && scrollCenter <= pageBottom) {
                    newCurrentPage = i + 1;
                    break;
                }
            }

            if (newCurrentPage !== currentPage) {
                setCurrentPage(newCurrentPage);
            }
        };

        // Initial page calculation
        setTimeout(handleScroll, 100);

        wrapper.addEventListener("scroll", handleScroll, { passive: true });
        return () => wrapper.removeEventListener("scroll", handleScroll);
    }, [isLoading, totalPages, currentPage]);

    if (error) {
        return (
            <div className={styles.docxWrapper}>
                <div className={styles.errorMessage}>
                    <h3>❌ Błąd</h3>
                    <p>{error}</p>
                    <small>Sprawdź czy plik jest prawidłowym dokumentem Word (.docx)</small>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.docxWrapper}>
            {/* Loading indicator */}
            {isLoading && (
                <div className={styles.loading}>
                    <div className={styles.loadingSpinner}></div>
                    <p>Ładowanie dokumentu...</p>
                </div>
            )}

            {/* Page indicator */}
            {!isLoading && totalPages > 0 && (
                <div className={styles.currentPage}>
                    Strona {currentPage} / {totalPages}
                </div>
            )}

            {/* Scrollable container */}
            <div
                ref={scrollRef}
                className={styles.scrollContainer}
            >
                <div ref={containerRef}></div>
            </div>
        </div>
    );
};

export default DocumentReader;