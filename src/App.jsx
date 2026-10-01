import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [reply, setReply] = useState("");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [language, setLanguage] = useState("Tamil");

  // Used for Gemini TTS audio
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);

  const languages = {
    Tamil: "ta-IN",
    Telugu: "te-IN",
    Malayalam: "ml-IN",
    Kannada: "kn-IN",
    Hindi: "hi-IN",
  };

  // ==================================================
  // CLEAN UP AUDIO WHEN APP CLOSES
  // ==================================================

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  // ==================================================
  // 🎤 VOICE INPUT
  // ==================================================

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

    // Stop current Gemini TTS audio
    stopSpeaking();

    const recognition = new SpeechRecognition();

    recognition.lang = languages[language];

    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      console.log("🎤 Voice recognition started");
      setListening(true);
    };

    recognition.onresult = (event) => {
      const transcript =
        event.results[0][0].transcript;

      console.log(
        "Voice input:",
        transcript
      );

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
      console.log(
        "🎤 Voice recognition ended"
      );

      setListening(false);
    };

    try {
      recognition.start();
    } catch (error) {
      console.error(
        "Could not start recognition:",
        error
      );

      setListening(false);
    }
  };

  // ==================================================
  // 🤖 SEND QUESTION TO GEMINI
  // ==================================================

  const handleSubmit = async () => {
    if (!text.trim()) {
      return;
    }

    // Stop existing audio
    stopSpeaking();

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

      console.log(
        "Gemini response:",
        data.reply
      );

      setReply(data.reply);

    } catch (error) {
      console.error(
        "Chat error:",
        error
      );

      setReply(
        "Sorry, I couldn't process your question."
      );
    }
  };

  // ==================================================
  // 🔊 GEMINI TEXT TO SPEECH
  // ==================================================

  const speakReply = async () => {
    if (
      !reply ||
      reply === "Thinking..."
    ) {
      return;
    }

    try {
      // Stop previous audio
      stopSpeaking();

      setSpeaking(true);

      console.log(
        "================================"
      );

      console.log(
        "🔊 REQUESTING GEMINI TTS"
      );

      console.log(
        "Language:",
        language
      );

      console.log(
        "Language code:",
        languages[language]
      );

      console.log(
        "Text:",
        reply
      );

      console.log(
        "================================"
      );

      // Request audio from backend
      const response = await fetch(
        "http://localhost:3001/api/tts",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            text: reply,
            language: language,
          }),
        }
      );

      // Check backend response
      if (!response.ok) {
        const errorData =
          await response
            .json()
            .catch(() => ({}));

        throw new Error(
          errorData.error ||
            "TTS request failed."
        );
      }

      // Convert response to audio
      const audioBlob =
        await response.blob();

      console.log(
        "🔊 Audio received:",
        audioBlob.size,
        "bytes"
      );

      // Create temporary URL
      const audioUrl =
        URL.createObjectURL(
          audioBlob
        );

      audioUrlRef.current =
        audioUrl;

      // Create audio player
      const audio =
        new Audio(audioUrl);

      audioRef.current =
        audio;

      // ==================================================
      // AUDIO FINISHED
      // ==================================================

      audio.onended = () => {
        console.log(
          "✅ COMPLETE RESPONSE SPOKEN"
        );

        setSpeaking(false);

        if (
          audioUrlRef.current
        ) {
          URL.revokeObjectURL(
            audioUrlRef.current
          );

          audioUrlRef.current =
            null;
        }

        audioRef.current =
          null;
      };

      // ==================================================
      // AUDIO ERROR
      // ==================================================

      audio.onerror = (error) => {
        console.error(
          "❌ Audio playback error:",
          error
        );

        setSpeaking(false);

        if (
          audioUrlRef.current
        ) {
          URL.revokeObjectURL(
            audioUrlRef.current
          );

          audioUrlRef.current =
            null;
        }

        audioRef.current =
          null;
      };

      // ==================================================
      // PLAY AUDIO
      // ==================================================

      await audio.play();

      console.log(
        "▶️ Gemini TTS audio started"
      );

    } catch (error) {
      console.error(
        "❌ TTS error:",
        error
      );

      setSpeaking(false);

      alert(
        "Unable to play the response. Please try again."
      );
    }
  };

  // ==================================================
  // 🛑 STOP SPEAKING
  // ==================================================

  const stopSpeaking = () => {
    if (audioRef.current) {
      console.log(
        "🛑 Stopping audio"
      );

      audioRef.current.pause();

      audioRef.current.currentTime = 0;

      audioRef.current =
        null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(
        audioUrlRef.current
      );

      audioUrlRef.current =
        null;
    }

    setSpeaking(false);
  };

  // ==================================================
  // UI
  // ==================================================

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

            // Stop current audio
            stopSpeaking();

            // Stop listening state
            setListening(false);

            // Change language
            setLanguage(
              newLanguage
            );

            // Clear previous question
            setText("");

            // Clear previous response
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