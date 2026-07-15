import clsx from "clsx";
import { format } from "date-fns";
import { useAlarmClock } from "./hooks";
import { getAlarmStatusMessage } from "./alarmStatus";
import { SOUND_OPTIONS } from "./constants";
import { SoundSelector } from "./components/SoundSelector";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { useFontLoading } from "./useFontLoading";

function App() {
  const {
    currentTime,
    selectedMinutes,
    selectedSound,
    isAlarmPlaying,
    alarmStatus,
    nextAlarmTime,
    audioRef,
    previewAudioRef,
    handleMinuteChange,
    handleSoundChange,
    previewSound,
  } = useAlarmClock();

  const isFontLoaded = useFontLoading("OtherHand");
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  const alarmStatusMessage = getAlarmStatusMessage(
    alarmStatus,
    nextAlarmTime
  );

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center bg-gray-100 font-otherhand">
      {/* Loading Spinner */}
      {!isFontLoaded && (
        <div className="fade-in-container loaded fixed inset-0 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      )}

      {/* Main Content */}
      <div className={clsx("fade-in-container", isFontLoaded && "loaded")}>
        <div className="mt-6 w-[240px] max-w-[84vw] text-center">
          <h1 className="text-6xl font-bold text-gray-800">
            {format(currentTime, "HH:mm:ss")}
          </h1>

          <fieldset className="mt-6">
            <legend className="mb-2 block w-full text-xl text-gray-600">
              Set Alarm Minutes:
            </legend>
            <div className="flex items-center justify-center gap-2">
              {([0, 1] as const).map((slotIndex) => (
                <select
                  key={slotIndex}
                  id={`minute-select-${slotIndex + 1}`}
                  aria-label={`${slotIndex === 0 ? "First" : "Second"} alarm minute`}
                  value={
                    selectedMinutes[slotIndex] === null
                      ? ""
                      : selectedMinutes[slotIndex]
                  }
                  onChange={(event) => handleMinuteChange(slotIndex, event)}
                  className="min-w-[88px] rounded-md border border-gray-300 bg-white px-3 py-2 text-center text-xl text-gray-800 shadow-sm outline-none transition-colors focus:border-gray-500"
                >
                  <option value="">--</option>
                  {minutes.map((minute) => (
                    <option
                      key={minute}
                      value={minute}
                      disabled={selectedMinutes[slotIndex === 0 ? 1 : 0] === minute}
                    >
                      {minute.toString().padStart(2, "0")}
                    </option>
                  ))}
                </select>
              ))}
            </div>

            <p
              aria-live="polite"
              className={clsx(
                "mt-3 min-h-6 text-base leading-6",
                alarmStatus === "ready" && "text-green-600",
                alarmStatus === "error" && "text-red-500",
                alarmStatus !== "ready" &&
                  alarmStatus !== "error" &&
                  "text-gray-500"
              )}
            >
              {alarmStatusMessage || "\u00a0"}
            </p>
          </fieldset>

          {!SOUND_OPTIONS.find((option) => option.id === selectedSound)
            ?.isNotification && (
            <audio
              ref={audioRef}
              src={
                SOUND_OPTIONS.find((option) => option.id === selectedSound)
                  ?.file
              }
            />
          )}

          {/* Preview audio element */}
          <audio ref={previewAudioRef} />

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

        <SoundSelector
          selectedSound={selectedSound}
          onSoundChange={handleSoundChange}
          onPreviewSound={previewSound}
        />

        {/* GitHub link */}
        <div className="fixed bottom-5 right-5">
          <a
            className="p-2 size-10 rounded-full bg-white inline-block"
            href="https://github.com/sunjae-kim/tralalero-tralalarm"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 496 512">
              <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3 .3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5 .3-6.2 2.3zm44.2-1.7c-2.9 .7-4.9 2.6-4.6 4.9 .3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3 .7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3 .3 2.9 2.3 3.9 1.6 1 3.6 .7 4.3-.7 .7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3 .7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3 .7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}

export default App;
