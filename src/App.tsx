import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import clsx from "clsx";

function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedMinute, setSelectedMinute] = useState<number | null>(null);
  const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedMinute = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const currentMinute = currentTime.getMinutes();

    if (
      selectedMinute !== null &&
      currentMinute === selectedMinute &&
      lastPlayedMinute.current !== currentMinute
    ) {
      if (audioRef.current) {
        audioRef.current.play();
        setIsAlarmPlaying(true);
        lastPlayedMinute.current = currentMinute;
      }
    }

    if (
      lastPlayedMinute.current !== null &&
      lastPlayedMinute.current !== currentMinute
    ) {
      lastPlayedMinute.current = null;
      setIsAlarmPlaying(false);
    }
  }, [currentTime, selectedMinute]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => {
        setIsAlarmPlaying(false);
      };
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
      }
    };
  }, []);

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value, 10);
    setSelectedMinute(isNaN(value) ? null : value);
  };

  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-100 font-otherhand">
      <div className="text-center w-[200px] mt-10">
        <h1 className="text-6xl font-bold text-gray-800">
          {format(currentTime, "HH:mm:ss")}
        </h1>

        <div className="mt-6">
          <label
            htmlFor="minute-select"
            className="block text-xl text-gray-600 mb-2"
          >
            Set Alarm Minute:
          </label>
          <select
            id="minute-select"
            value={selectedMinute === null ? "" : selectedMinute}
            onChange={handleMinuteChange}
            className="px-4 py-2 rounded-md border border-gray-300 text-xl"
          >
            <option value="">Select Minute</option>
            {minutes.map((minute) => (
              <option key={minute} value={minute}>
                {minute.toString().padStart(2, "0")}
              </option>
            ))}
          </select>

          <p
            className={clsx(
              "mt-2 text-lg text-green-600",
              selectedMinute ? "visible" : "invisible"
            )}
          >
            Alarm will sound at minute {selectedMinute}
          </p>
        </div>

        <audio ref={audioRef} src="/sound/tralalero-tralala.mp3" />

        <div className={isAlarmPlaying ? "visible" : "invisible"}>
          <div
            className="tenor-gif-embed"
            data-postid="9781035983536344817"
            data-share-method="host"
            data-aspect-ratio="1.2029"
            data-width="100%"
          >
            <a href="https://tenor.com/view/tralalelo-tralalala-gif-9781035983536344817">
              Tralalelo Tralalala GIF
            </a>
            from{" "}
            <a href="https://tenor.com/search/tralalelo+tralalala-gifs">
              Tralalelo Tralalala GIFs
            </a>
          </div>
        </div>

        <script
          type="text/javascript"
          async
          src="https://tenor.com/embed.js"
        ></script>
      </div>
    </div>
  );
}

export default App;
