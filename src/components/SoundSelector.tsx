import clsx from "clsx";
import { useEffect, useState } from "react";
import { SOUND_OPTIONS } from "../constants";
import type { SoundOption } from "../types";

interface SoundSelectorProps {
  selectedSound: string;
  onSoundChange: (soundId: string) => void;
  onPreviewSound: (option: SoundOption) => void;
}

export const SoundSelector = ({ 
  selectedSound, 
  onSoundChange, 
  onPreviewSound 
}: SoundSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSelector = () => {
    setIsOpen(!isOpen);
  };

  const handleSoundChange = (soundId: string) => {
    onSoundChange(soundId);
    setIsOpen(false);
  };

  // Close selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isOpen && !target.closest(".sound-selector-container")) {
        setIsOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen]);

  const selectedOption = SOUND_OPTIONS.find(option => option.id === selectedSound);
  const isNotificationSelected = selectedOption?.isNotification;

  return (
    <div className="fixed bottom-5 left-5 sound-selector-container">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSelector}
          className="p-3 size-12 rounded-full bg-white shadow-lg hover:bg-gray-50 transition-colors cursor-pointer"
          title="Select alarm sound"
        >
          {isNotificationSelected ? (
            // Muted sound icon with slash
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6"
            >
              <polygon points="11 5,6 9,2 9,2 15,6 15,11 19,11 5" />{" "}
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <line x1="22" y1="2" x2="2" y2="22" />
            </svg>
          ) : (
            // Normal sound icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6"
            >
              <polygon points="11 5,6 9,2 9,2 15,6 15,11 19,11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
        </button>
        <div className="bg-white px-3 py-2 rounded-lg shadow-lg">
          <span className="text-sm font-medium text-gray-700">
            {selectedOption?.name}
          </span>
        </div>
      </div>

      {/* Sound selection modal */}
      {isOpen && (
        <div className="absolute bottom-14 left-0 bg-white rounded-lg shadow-xl border p-3 min-w-[280px] w-max">
          <div className="text-sm font-semibold text-gray-700 mb-2 px-2">
            Select Alarm Sound
          </div>
          {SOUND_OPTIONS.map((option) => (
            <div
              key={option.id}
              className={clsx(
                "flex items-center justify-between px-3 py-2 rounded hover:bg-gray-100 transition-colors text-sm",
                selectedSound === option.id && "bg-blue-50"
              )}
            >
              <button
                onClick={() => handleSoundChange(option.id)}
                className={clsx(
                  "flex flex-1 text-left cursor-pointer",
                  selectedSound === option.id && "text-blue-700"
                )}
              >
                <span
                  className={clsx(
                    selectedSound === option.id ? "visible" : "invisible",
                    "mr-2"
                  )}
                >
                  ✓
                </span>

                <div className="flex items-center gap-2">
                  <span>{option.name}</span>
                  {option.isNotification && (
                    <span
                      className={clsx(
                        "text-xs px-1.5 py-0.5 rounded",
                        Notification.permission === "granted"
                          ? "bg-green-100 text-green-700"
                          : Notification.permission === "denied"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      )}
                    >
                      {Notification.permission === "granted"
                        ? "granted"
                        : Notification.permission === "denied"
                        ? "denied"
                        : "default"}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPreviewSound(option);
                }}
                className="ml-2 p-1 rounded-full hover:bg-gray-200 transition-colors"
                title={`Preview ${option.name}`}
              >
                {option.isNotification ? (
                  // Notification preview icon
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4"
                  >
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                ) : (
                  // Play button icon
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4"
                  >
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
