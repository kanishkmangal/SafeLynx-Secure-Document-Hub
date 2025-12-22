import React, { useState, useEffect } from 'react';

const Typewriter = ({ text, speed = 100, startDelay = 0, cursor = true }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        // Reset state when text changes
        setDisplayedText('');
        setIsTyping(false);

        let typingTimeout;
        const startTimeout = setTimeout(() => {
            setIsTyping(true);
            let currentIndex = 0;

            const typeChar = () => {
                if (currentIndex < text.length) {
                    setDisplayedText(text.substring(0, currentIndex + 1));
                    currentIndex++;
                    typingTimeout = setTimeout(typeChar, speed);
                } else {
                    setIsTyping(false);
                }
            };

            typeChar();
        }, startDelay);

        return () => {
            clearTimeout(startTimeout);
            clearTimeout(typingTimeout);
        };
    }, [text, speed, startDelay]);

    return (
        <span className="inline-block">
            {displayedText}
            {cursor && (
                <span className={`inline-block ml-0.5 w-0.5 h-[1em] bg-current align-middle ${!isTyping ? 'animate-pulse' : 'opacity-100'}`}>
                    &nbsp;
                </span>
            )}
        </span>
    );
};

export default Typewriter;
