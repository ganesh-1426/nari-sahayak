import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [reply, setReply] = useState("");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [language, setLanguage] = useState("Tamil");

  // Used to safely stop an old speech session
  const speechSessionRef = useRef(0);

  const languages = {
    Tamil: "ta-IN",
    Telugu: "te-IN",
    Malayalam: "ml-IN",
    Kannada: "kn-IN",
    Hindi: "hi-IN",
  };

  /*
   * Voices we found on your Mac/Chrome.
   *
   * Tamil     -> Vani
   * Telugu    -> Geeta
   * Kannada   -> Soumya
   * Hindi     -> Lekha / Google हिन्दी
   *
   * Malayalam is not currently available in Chrome.
   */
  const preferredVoices = {
    Tamil: ["Vani"],
    Telugu: ["Geeta"],
    Kannada: ["Soumya"],
    Hindi: ["Lekha", "Google हिन्दी"],
    Malayalam: [],
  };

  // --------------------------------------------------
  // Load browser speech voices
  // --------------------------------------------------
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();

      console.log(
        "Available speech voices:",
        voices.map((voice) => `${voice.name} — ${voice.lang}`)
      );
    };

    loadVoices();

    // Chrome may load voices slightly after the page loads
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      loadVoices
    );

    return () => {
      window.speechSynthesis.removeEventListener(
        "voiceschanged",
        loadVoices
      );
    };
  }, []);

  // --------------------------------------------------
  // 🎤 Voice Input
  // --------------------------------------------------
  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Voice recognition is not supported in this browser."
      );
      return;
    }

    // Stop any speech currently playing
    window.speechSynthesis.cancel();
    setSpeaking(false);

    const recognition = new SpeechRecognition();

    recognition.lang = languages[language];

    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event) => {
      const transcript =
        event.results[0][0].transcript;

      console.log("Voice input:", transcript);

      setText(transcript);
    };

    recognition.onerror = (event) => {
      console.error(
        "Speech recognition error:",
        event.error
      );

      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    try {
      recognition.start();
    } catch (error) {
      console.error(
        "Could not start speech recognition:",
        error
      );

      setListening(false);
    }
  };

  // --------------------------------------------------
  // 🤖 Send question to Gemini
  // --------------------------------------------------
  const handleSubmit = async () => {
    if (!text.trim()) {
      return;
    }

    // Stop current speech
    speechSessionRef.current++;

    window.speechSynthesis.cancel();

    setSpeaking(false);

    setReply("Thinking...");

    try {
      const response = await fetch(
        "http://localhost:3001/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            message: text,
            language: language,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to process the request."
        );
      }

      setReply(data.reply);
    } catch (error) {
      console.error("Chat error:", error);

      setReply(
        "Sorry, I couldn't process your question."
      );
    }
  };

  // --------------------------------------------------
  // 🔊 Get the correct voice
  // --------------------------------------------------
  const getVoiceForLanguage = () => {
    const voices =
      window.speechSynthesis.getVoices();

    const languageCode =
      languages[language].toLowerCase();

    console.log(
      "Looking for voice:",
      language,
      languageCode
    );

    console.log(
      "Available voices:",
      voices.map(
        (voice) =>
          `${voice.name} — ${voice.lang}`
      )
    );

    // ------------------------------------------------
    // 1. Try our known preferred voice
    // ------------------------------------------------
    const preferredNames =
      preferredVoices[language] || [];

    for (const preferredName of preferredNames) {
      const preferredVoice = voices.find(
        (voice) =>
          voice.name
            .toLowerCase()
            .includes(preferredName.toLowerCase()) &&
          voice.lang.toLowerCase() === languageCode
      );

      if (preferredVoice) {
        console.log(
          "Using preferred voice:",
          preferredVoice.name,
          preferredVoice.lang
        );

        return preferredVoice;
      }
    }

    // ------------------------------------------------
    // 2. Exact language match
    // ------------------------------------------------
    const exactVoice = voices.find(
      (voice) =>
        voice.lang.toLowerCase() ===
        languageCode
    );

    if (exactVoice) {
      console.log(
        "Using exact language voice:",
        exactVoice.name,
        exactVoice.lang
      );

      return exactVoice;
    }

    // ------------------------------------------------
    // 3. Same language family
    // ------------------------------------------------
    const languagePrefix =
      languageCode.split("-")[0];

    const familyVoice = voices.find(
      (voice) =>
        voice.lang
          .toLowerCase()
          .startsWith(languagePrefix)
    );

    if (familyVoice) {
      console.log(
        "Using language-family voice:",
        familyVoice.name,
        familyVoice.lang
      );

      return familyVoice;
    }

    // ------------------------------------------------
    // 4. Nothing found
    // ------------------------------------------------
    console.log(
      "No voice found for:",
      language,
      languageCode
    );

    return null;
  };

  // --------------------------------------------------
  // 🔊 Create safe speech chunks
  // --------------------------------------------------
  const createSpeechChunks = (response) => {
    const cleanText = response
      .replace(/\r/g, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanText) {
      return [];
    }

    /*
     * First try to split by sentences.
     *
     * Supports:
     * .
     * !
     * ?
     * ।
     * ॥
     */
    const sentences = cleanText
      .split(/(?<=[.!?।॥])\s+/)
      .map((sentence) =>
        sentence.trim()
      )
      .filter(Boolean);

    const chunks = [];

    sentences.forEach((sentence) => {
      /*
       * Keep chunks reasonably small.
       * This helps Chrome speech synthesis
       * finish the entire response reliably.
       */
      if (sentence.length <= 150) {
        chunks.push(sentence);
        return;
      }

      // Long sentence → split by words
      const words = sentence.split(" ");

      let currentChunk = "";

      words.forEach((word) => {
        const testChunk = currentChunk
          ? `${currentChunk} ${word}`
          : word;

        if (testChunk.length > 120) {
          if (currentChunk) {
            chunks.push(currentChunk);
          }

          currentChunk = word;
        } else {
          currentChunk = testChunk;
        }
      });

      if (currentChunk) {
        chunks.push(currentChunk);
      }
    });

    console.log(
      "Speech chunks:",
      chunks
    );

    return chunks;
  };

  // --------------------------------------------------
  // 🔊 Speak complete Gemini response
  // --------------------------------------------------
  const speakReply = () => {
    if (
      !reply ||
      reply === "Thinking..."
    ) {
      return;
    }

    const synth =
      window.speechSynthesis;

    // Stop previous speech
    synth.cancel();

    // Create a new speech session
    speechSessionRef.current++;

    const currentSession =
      speechSessionRef.current;

    const languageCode =
      languages[language];

    const voice =
      getVoiceForLanguage();

    // ------------------------------------------------
    // Malayalam currently has no browser voice
    // ------------------------------------------------
    if (!voice) {
      setSpeaking(false);

      alert(
        `${language} speech voice is not available in your Chrome right now.\n\n` +
        `Your browser currently has no ${languageCode} voice.\n\n` +
        `Tamil, Telugu, Kannada and Hindi are available.`
      );

      return;
    }

    // Create chunks
    const chunks =
      createSpeechChunks(reply);

    if (chunks.length === 0) {
      return;
    }

    console.log(
      `Starting speech in ${language}`
    );

    console.log(
      "Voice:",
      voice.name,
      voice.lang
    );

    console.log(
      "Total chunks:",
      chunks.length
    );

    setSpeaking(true);

    let currentIndex = 0;

    // ------------------------------------------------
    // Speak one chunk at a time
    // ------------------------------------------------
    const speakNextChunk = () => {
      /*
       * If Stop was pressed or a new speech session
       * started, don't continue.
       */
      if (
        currentSession !==
        speechSessionRef.current
      ) {
        return;
      }

      if (
        currentIndex >=
        chunks.length
      ) {
        console.log(
          "Finished speaking complete response."
        );

        setSpeaking(false);

        return;
      }

      const currentText =
        chunks[currentIndex];

      console.log(
        `Speaking ${currentIndex + 1}/${chunks.length}:`,
        currentText
      );

      const utterance =
        new SpeechSynthesisUtterance(
          currentText
        );

      // IMPORTANT
      utterance.lang =
        languageCode;

      utterance.voice =
        voice;

      /*
       * Speaking speed
       *
       * 0.8 = slow and clear
       */
      utterance.rate = 0.8;

      utterance.pitch = 1;

      utterance.volume = 1;

      // ----------------------------------------------
      // Chunk finished
      // ----------------------------------------------
      utterance.onend = () => {
        if (
          currentSession !==
          speechSessionRef.current
        ) {
          return;
        }

        currentIndex++;

        /*
         * Small pause between chunks
         */
        setTimeout(() => {
          speakNextChunk();
        }, 180);
      };

      // ----------------------------------------------
      // Speech error
      // ----------------------------------------------
      utterance.onerror = (event) => {
        console.error(
          "Speech synthesis error:",
          event.error
        );

        /*
         * "canceled" / "interrupted" usually means
         * the user pressed Stop or another speech
         * session started.
         */
        if (
          event.error === "canceled" ||
          event.error === "interrupted"
        ) {
          return;
        }

        if (
          currentSession !==
          speechSessionRef.current
        ) {
          return;
        }

        /*
         * If one chunk fails, continue with
         * the remaining response.
         */
        currentIndex++;

        setTimeout(() => {
          speakNextChunk();
        }, 180);
      };

      synth.speak(utterance);
    };

    speakNextChunk();
  };

  // --------------------------------------------------
  // 🛑 Stop speaking
  // --------------------------------------------------
  const stopSpeaking = () => {
    // Invalidate current speech session
    speechSessionRef.current++;

    window.speechSynthesis.cancel();

    setSpeaking(false);

    console.log(
      "Speech stopped."
    );
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <div className="app">
      <div className="container">

        {/* Logo */}
        <div className="logo">
          🌸
        </div>

        {/* Title */}
        <h1>
          Nari Sahayak
        </h1>

        <p className="tagline">
          Government services in your own language
        </p>

        {/* Language Selection */}
        <select
          className="language"
          value={language}
          onChange={(e) => {
            const newLanguage =
              e.target.value;

            // Stop speech
            speechSessionRef.current++;

            window.speechSynthesis.cancel();

            setSpeaking(false);

            // Stop listening
            setListening(false);

            // Change language
            setLanguage(newLanguage);

            // Clear previous conversation
            setText("");
            setReply("");
          }}
        >
          <option value="Tamil">
            🇮🇳 தமிழ்
          </option>

          <option value="Telugu">
            🇮🇳 తెలుగు
          </option>

          <option value="Malayalam">
            🇮🇳 മലയാളം
          </option>

          <option value="Kannada">
            🇮🇳 ಕನ್ನಡ
          </option>

          <option value="Hindi">
            🇮🇳 हिन्दी
          </option>
        </select>

        {/* Voice Input */}
        <button
          className={`voice-button ${
            listening
              ? "listening"
              : ""
          }`}
          onClick={
            startListening
          }
        >
          🎤

          <span>
            {listening
              ? "Listening..."
              : "Tap to Speak"}
          </span>
        </button>

        {/* OR */}
        <div className="divider">
          <span>
            OR
          </span>
        </div>

        {/* Text Input */}
        <div className="input-section">
          <input
            type="text"
            value={text}
            onChange={(e) =>
              setText(
                e.target.value
              )
            }
            placeholder="Type your question..."
            onKeyDown={(e) => {
              if (
                e.key === "Enter"
              ) {
                handleSubmit();
              }
            }}
          />

          <button
            className="send-button"
            onClick={
              handleSubmit
            }
          >
            ➤
          </button>
        </div>

        {/* AI Response */}
        {reply && (
          <div className="reply-box">

            <div className="reply-title">
              🤖 Nari Sahayak
            </div>

            <p>
              {reply}
            </p>

            {/* Speech Controls */}
            {reply !==
              "Thinking..." && (
              <div className="speech-controls">

                {!speaking ? (
                  <button
                    className="speak-button"
                    onClick={
                      speakReply
                    }
                  >
                    🔊 Listen to Response
                  </button>
                ) : (
                  <button
                    className="speak-button"
                    onClick={
                      stopSpeaking
                    }
                  >
                    🛑 Stop Speaking
                  </button>
                )}

              </div>
            )}

          </div>
        )}

        {/* Help Text */}
        <p className="help-text">
          You don't need to know English or technology.
          <br />
          Just speak naturally.
        </p>

      </div>
    </div>
  );
}

export default App;
