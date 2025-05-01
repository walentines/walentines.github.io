import { useState, useRef, useEffect } from "react";
import "./App.css";

function SketchCanvas({ onAdd }: { onAdd: (canvas: HTMLCanvasElement) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "black";
  }, []);

  const startDrawing = () => (drawing.current = true);
  const stopDrawing = () => {
    drawing.current = false;
    const ctx = canvasRef.current?.getContext("2d");
    ctx?.beginPath(); // Reset path
  };

  const draw = (x: number, y: number) => {
    if (!drawing.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    draw(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    draw(x, y);
  };

  const handleAddSketch = () => {
    if (!canvasRef.current) return;
    onAdd(canvasRef.current);
    const ctx = canvasRef.current.getContext("2d")!;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.beginPath();
  };

  return (
    <div style={{ marginBottom: "1rem" }}>
      <canvas
        ref={canvasRef}
        width={256}
        height={256}
        style={{ border: "1px solid black", display: "block", touchAction: "none" }}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onMouseMove={handleMouseMove}
        onTouchStart={startDrawing}
        onTouchEnd={stopDrawing}
        onTouchCancel={stopDrawing}
        onTouchMove={handleTouchMove}
      />
      <button type="button" onClick={handleAddSketch} style={{ marginTop: "0.5rem" }}>
        Add Sketch
      </button>
    </div>
  );
}

export default function VideoGenerator() {
  const [activeTab, setActiveTab] = useState<"generate" | "combine" | "sketch">("generate");
  const [promptImage, setPromptImage] = useState<File | null>(null);
  const [guidanceFiles, setGuidanceFiles] = useState<File[]>([]);
  const [useCanny, setUseCanny] = useState(true);
  const [includeBackground, setIncludeBackground] = useState(true);
  const [otherViews, setOtherViews] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sketches, setSketches] = useState<HTMLCanvasElement[]>([]);

  const BASE_URL = "https://8000-01jqemr6zft7pf7d6mj4h3j4n1.cloudspaces.litng.ai";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!promptImage) return alert("Please upload the prompt image.");

    setLoading(true);
    setVideoUrl(null);

    const formData = new FormData();
    formData.append("prompt_image", promptImage);

    if (activeTab === "generate") {
      if (guidanceFiles.length === 0) return alert("Upload guidance images.");
      formData.append("guidance_type", useCanny ? "canny" : "depth");
      formData.append("include_background", includeBackground ? "yes" : "no");
      guidanceFiles.forEach(file => formData.append("guidance_files", file));
    } else if (activeTab === "combine") {
      if (otherViews.length === 0) return alert("Upload other car views.");
      otherViews.forEach(file => formData.append("car_files", file));
    } else if (activeTab === "sketch") {
      if (sketches.length === 0) return alert("Draw at least one sketch.");
      formData.append("guidance_type", "canny");
      formData.append("include_background", "yes");
      for (let i = 0; i < sketches.length; i++) {
        const canvas = sketches[i];
        const blob = await new Promise<Blob>((res) => canvas.toBlob(blob => res(blob!), "image/png"));
        formData.append("guidance_files", new File([blob], `sketch_${i}.png`, { type: "image/png" }));
      }
    }

    const endpoint = activeTab === "combine" ? "combine_cars" : "generate_video";

    try {
      const res = await fetch(`${BASE_URL}/${endpoint}/?nocache=${Date.now()}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to generate video");
      const { video_filename } = await res.json();
      const url = `${BASE_URL}/static/${video_filename}?nocache=${Date.now()}`;
      setVideoUrl(url);
      setShowModal(true);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <div className="container">
      <h1>AutoMotion: AI-Powered Car Video Tool</h1>

      <div className="tabs">
        <div className={`tab ${activeTab === "generate" ? "active" : ""}`} onClick={() => setActiveTab("generate")}>Generate Short Video</div>
        <div className={`tab ${activeTab === "combine" ? "active" : ""}`} onClick={() => setActiveTab("combine")}>Combine Cars</div>
        <div className={`tab ${activeTab === "sketch" ? "active" : ""}`} onClick={() => setActiveTab("sketch")}>Sketch Video</div>
      </div>

      <form onSubmit={handleSubmit}>
        <label>Input Car Image:</label>
        <input type="file" accept="image/*" onChange={e => setPromptImage(e.target.files?.[0] || null)} />

        {activeTab === "generate" && (
          <>
            <label>Guidance Type:</label>
            <div className="radio-group">
              <label><input type="radio" value="canny" checked={useCanny} onChange={() => setUseCanny(true)} /> Canny</label>
              <label><input type="radio" value="depth" checked={!useCanny} onChange={() => setUseCanny(false)} /> Depth</label>
            </div>
            <label>{useCanny ? "Canny Edges:" : "Depth Maps:"}</label>
            <input type="file" accept="image/*" multiple onChange={e => setGuidanceFiles(Array.from(e.target.files || []))} />
            <label>Include Background:</label>
            <div className="radio-group">
              <label><input type="radio" value="with-bg" checked={includeBackground} onChange={() => setIncludeBackground(true)} /> Yes</label>
              <label><input type="radio" value="without-bg" checked={!includeBackground} onChange={() => setIncludeBackground(false)} /> No</label>
            </div>
          </>
        )}

        {activeTab === "combine" && (
          <>
            <label>Other Car Views:</label>
            <input type="file" accept="image/*" multiple onChange={e => setOtherViews(Array.from(e.target.files || []))} />
          </>
        )}

        {activeTab === "sketch" && (
          <>
            <p>Draw sketches of your desired car:</p>
            <SketchCanvas onAdd={(canvas) => {
              setSketches(prev => [...prev, canvas]);
            }} />
            <p>Sketch count: {sketches.length}</p>
          </>
        )}

        <button type="submit" disabled={loading}>{loading ? "Processing..." : "Submit"}</button>
      </form>

      {loading && (
        <div className="progress-bar-container">
          <div className="progress-bar" />
        </div>
      )}

      {showModal && videoUrl && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <video src={videoUrl} controls autoPlay loop style={{ width: "100%" }} />
            <div style={{ marginTop: "1em" }}>
              <a href={videoUrl} download="generated_video.mp4">
                <button type="button">Download Video</button>
              </a>
            </div>
            <button onClick={() => setShowModal(false)} style={{ marginTop: "1em" }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
