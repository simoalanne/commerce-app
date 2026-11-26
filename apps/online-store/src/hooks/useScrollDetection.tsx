import { useLayoutEffect, useState } from "react";

export const useScrollDetection = () => {
  const [scrolledY, setScrolledY] = useState(0);

  useLayoutEffect(() => {
    const handleScroll = () => setScrolledY(window.scrollY);

    handleScroll();
    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return { scrolledY, isScrolled: scrolledY > 0 };
};
