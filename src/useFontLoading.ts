import { useEffect, useState } from "react";

export const useFontLoading = (fontFamily: string = "OtherHand"): boolean => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check if FontFace API is supported
    if (!("fonts" in document)) {
      // Fallback: assume font is loaded after a timeout
      const timeout = setTimeout(() => {
        setIsLoaded(true);
      }, 1000);
      return () => clearTimeout(timeout);
    }

    const checkFont = async () => {
      try {
        // Check if the font is already loaded
        const fontCheck = await document.fonts.check(`1em ${fontFamily}`);
        if (fontCheck) {
          setIsLoaded(true);
          return;
        }

        // Listen for font load events
        const handleFontLoad = () => {
          setIsLoaded(true);
        };

        document.fonts.addEventListener("loadingdone", handleFontLoad);

        // Also try to load the font explicitly
        await document.fonts.load(`1em ${fontFamily}`);

        // Check again after attempting to load
        const recheckFont = await document.fonts.check(`1em ${fontFamily}`);
        if (recheckFont) {
          setIsLoaded(true);
        }

        return () => {
          document.fonts.removeEventListener("loadingdone", handleFontLoad);
        };
      } catch (error) {
        console.warn("Font loading detection failed:", error);
        // Fallback: assume font is loaded
        setIsLoaded(true);
      }
    };

    checkFont();
  }, [fontFamily]);

  return isLoaded;
};
