import bgImage from "../assets/images/Gemini_Generated_Image_n9ahm9n9ahm9n9ah.png";

export default function Hero({ children }) {
  return (
    <div className="relative w-full h-[550px] md:h-[600px] lg:h-[650px] overflow-hidden flex flex-col">
      {/* High-quality scenic background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-[1] animate-fade-in"
        style={{ backgroundImage: `url(${bgImage})` }}
      />

      {/* Bottom-weighted scrim: top stays mostly photo, bottom half/third
          (where the greeting content now sits) darkens for legibility */}
      <div
        className="absolute inset-0 z-[2]"
        style={{
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.20) 0%, rgba(15,23,42,0.25) 40%, rgba(15,23,42,0.55) 62%, rgba(15,23,42,0.80) 100%)",
        }}
      />

      {/* Smooth bottom gradient transitioning to paper background */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-b from-transparent to-paper z-[3] pointer-events-none" 
      />

      {/* Children content placed above the background, anchored to the bottom
          third of the hero rather than centered/filling it */}
      <div className="relative z-[10] flex flex-col flex-grow justify-end">
        {children}
      </div>
    </div>
  );
}