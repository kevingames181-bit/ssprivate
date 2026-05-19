import { Poster } from '../components/Poster';

export const PosterPage = () => {
  const downloadPoster = () => {
    const svg = document.querySelector('.poster-svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = 'seascope-poster.png';
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="poster-page">
      <div className="poster-controls">
        <h1>SeaScope Marketing Poster</h1>
        <p>High-resolution digital poster for marketing and presentations</p>
        <button onClick={downloadPoster} className="download-btn">
          Download as PNG (1024x1024)
        </button>
      </div>
      <Poster />
    </div>
  );
};
