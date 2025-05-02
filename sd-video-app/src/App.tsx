import { useState, useRef, useEffect } from "react";
import "./App.css";

function SketchCanvas({ onAdd }: { onAdd: (canvas: HTMLCanvasElement) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [brushSize, setBrushSize] = useState(4);
  const brushSizeRef = useRef(brushSize);

  useEffect(() => {
    brushSizeRef.current = brushSize; // ✅ Sync state to ref
  }, [brushSize]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.strokeStyle = "black";
  }, []);

  const startDrawing = () => {
    drawing.current = true;
  };

  const stopDrawing = () => {
    drawing.current = false;
    const ctx = canvasRef.current?.getContext("2d");
    ctx?.beginPath(); // reset path
  };

  const draw = (x: number, y: number) => {
    if (!drawing.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    ctx.lineWidth = brushSizeRef.current;
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

    const clone = document.createElement("canvas");
    clone.width = canvasRef.current.width;
    clone.height = canvasRef.current.height;
    const ctxClone = clone.getContext("2d")!;
    ctxClone.drawImage(canvasRef.current, 0, 0);

    // Save as base64 in localStorage
    const dataUrl = clone.toDataURL("image/png");
    const stored = JSON.parse(localStorage.getItem("sketches") || "[]");
    stored.push(dataUrl);
    localStorage.setItem("sketches", JSON.stringify(stored));

    onAdd(clone);

    const ctx = canvasRef.current.getContext("2d")!;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.beginPath();
  };

  return (
    <div style={{ marginBottom: "1rem", textAlign: "center" }}>
      <canvas
        ref={canvasRef}
        width={1024}
        height={768}
        style={{
          border: "1px solid black",
          display: "block",
          margin: "0 auto",
          touchAction: "none",
          maxWidth: "100%",
          height: "auto",
        }}
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onMouseMove={handleMouseMove}
        onTouchStart={startDrawing}
        onTouchEnd={stopDrawing}
        onTouchCancel={stopDrawing}
        onTouchMove={handleTouchMove}
      />
      <div style={{ margin: "1rem 0", textAlign: "center" }}>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
          <span>Brush Size: {brushSize}</span>
          <input
            type="range"
            min={1}
            max={30}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
          <span
            style={{
              width: `${brushSize}px`,
              height: `${brushSize}px`,
              borderRadius: "50%",
              backgroundColor: "black",
              display: "inline-block",
              border: "1px solid #999",
            }}
          />
        </label>
      </div>
      <button type="button" onClick={handleAddSketch} style={{ marginTop: "0.5rem" }}>
        Add Sketch
      </button>
    </div>
  );
}

export default function VideoGenerator() {
  const [activeTab, setActiveTab] = useState<"generate" | "combine" | "sketch">(() => {
    return (localStorage.getItem("activeTab") as "generate" | "combine" | "sketch") || "generate";
  });
  const [promptImage, setPromptImage] = useState<File | null>(null);
  const [guidanceFiles, setGuidanceFiles] = useState<File[]>([]);
  const [useCanny, setUseCanny] = useState(true);
  const [includeBackground, setIncludeBackground] = useState(true);
  const [otherViews, setOtherViews] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sketches, setSketches] = useState<HTMLCanvasElement[]>([]);
  const [guidanceIndex, setGuidanceIndex] = useState(0);
  const [otherViewsIndex, setOtherViewsIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [showSketchModal, setShowSketchModal] = useState(false);

  const BASE_URL = "https://8000-01jqemr6zft7pf7d6mj4h3j4n1.cloudspaces.litng.ai";

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("sketches") || "[]") as string[];
    const canvases: HTMLCanvasElement[] = stored.map((dataUrl) => {
      const img = new Image();
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d")!;
      img.src = dataUrl;
      img.onload = () => ctx.drawImage(img, 0, 0);
      return canvas;
    });
    setSketches(canvases);

    const promptDataUrl = localStorage.getItem("promptImage");
    if (promptDataUrl) {
      fetch(promptDataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "prompt_image.png", { type: "image/png" });
          setPromptImage(file);
        });
    }

    // Restore guidance files
    const storedGuidance = JSON.parse(localStorage.getItem("guidanceFiles") || "[]");
    if (storedGuidance.length > 0) {
      Promise.all(
        storedGuidance.map((url: string, i: number) =>
          fetch(url)
            .then(res => res.blob())
            .then(blob => new File([blob], `guidance_${i}.png`, { type: "image/png" }))
        )
      ).then(files => setGuidanceFiles(files));
    }

    // Restore other car views
    const storedOtherViews = JSON.parse(localStorage.getItem("otherCarViews") || "[]");
    if (storedOtherViews.length > 0) {
      Promise.all(
        storedOtherViews.map((url: string, i: number) =>
          fetch(url)
            .then(res => res.blob())
            .then(blob => new File([blob], `carview_${i}.png`, { type: "image/png" }))
        )
      ).then(files => setOtherViews(files));
    }

    const storedVideoUrl = localStorage.getItem("generatedVideoUrl");
    if (storedVideoUrl) setVideoUrl(storedVideoUrl);
  }, []);

  function ImageCarousel({
    files,
    currentIndex,
    setIndex,
    label,
  }: {
    files: File[],
    currentIndex: number,
    setIndex: (i: number) => void,
    label: string,
  }) {
    const file = files[currentIndex];
  
    if (!file) return null;
  
    return (
      <div className="prompt-preview">
        <strong className="prompt-preview-title">{label}</strong>
        <img
          src={URL.createObjectURL(file)}
          alt={`${label} ${currentIndex + 1}`}
          className="prompt-preview-image"
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
        <button
  type="button"
  className="carousel-button"
  onClick={() => setIndex((currentIndex - 1 + files.length) % files.length)}
  disabled={files.length <= 1}
>
        ◀
      </button>
      <span style={{ fontSize: "0.85rem", color: "#555", padding: "0 8px" }}>
        {currentIndex + 1} / {files.length}
      </span>
      <button
        type="button"
        className="carousel-button"
        onClick={() => setIndex((currentIndex + 1) % files.length)}
        disabled={files.length <= 1}
      >
        ▶
      </button>   
        </div>
      </div>
    );
  }

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
      formData.append("sketch", "false");
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
      formData.append("sketch", "true");
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
      localStorage.setItem("generatedVideoUrl", url);
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
        <div className={`tab ${activeTab === "generate" ? "active" : ""}`} onClick={() => {
          setActiveTab("generate");
          localStorage.setItem("activeTab", "generate");
        }}>Generate Short Video</div>
        <div className={`tab ${activeTab === "combine" ? "active" : ""}`} onClick={() => {
          setActiveTab("combine");
          localStorage.setItem("activeTab", "combine");
        }}>Combine Cars</div>
        <div className={`tab ${activeTab === "sketch" ? "active" : ""}`} onClick={() => {
          setActiveTab("sketch");
          localStorage.setItem("activeTab", "sketch");
        }}>Sketch Video</div>
      </div>

      <form onSubmit={handleSubmit}>
        <label>Input Car Image:</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setPromptImage(file);

            const reader = new FileReader();
            reader.onloadend = () => {
              localStorage.setItem("promptImage", reader.result as string);
            };
            reader.readAsDataURL(file);
          }}
        />
{promptImage && (
  <div className="prompt-preview">
    <strong className="prompt-preview-title">Selected Image</strong>
    <img
      src={URL.createObjectURL(promptImage)}
      alt="Prompt Preview"
      className="prompt-preview-image"
    />
    <p className="prompt-preview-note">You can replace this image above</p>
    <button
      type="button"
      className="prompt-preview-remove"
      onClick={() => {
        setPromptImage(null);
        localStorage.removeItem("promptImage");
      }}
    >
      Remove Image
    </button>
  </div>
)}

        {activeTab === "generate" && (
          <>
            <label>Guidance Type:</label>
            <div className="radio-group">
              <label><input type="radio" value="canny" checked={useCanny} onChange={() => setUseCanny(true)} /> Canny</label>
              <label><input type="radio" value="depth" checked={!useCanny} onChange={() => setUseCanny(false)} /> Depth</label>
            </div>
            <label>{useCanny ? "Canny Edges:" : "Depth Maps:"}</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setGuidanceFiles(files);

                // Store base64 versions in localStorage
                const readers = files.map(file => {
                  return new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                  });
                });

                Promise.all(readers).then(base64s => {
                  localStorage.setItem("guidanceFiles", JSON.stringify(base64s));
                });
              }}
            />
            {guidanceFiles.length > 0 && (
              <ImageCarousel
                files={guidanceFiles}
                currentIndex={guidanceIndex}
                setIndex={setGuidanceIndex}
                label={useCanny ? "Canny Edge" : "Depth Map"}
              />
            )}
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
            <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              setOtherViews(files);

              const readers = files.map(file => {
                return new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(file);
                });
              });

              Promise.all(readers).then(base64s => {
                localStorage.setItem("otherCarViews", JSON.stringify(base64s));
              });
            }}
          />
          {otherViews.length > 0 && (
            <ImageCarousel
              files={otherViews}
              currentIndex={otherViewsIndex}
              setIndex={setOtherViewsIndex}
              label="Car View"
            />
          )}
          </>
        )}

        {activeTab === "sketch" && (
          <>
            <p>Draw sketches of your desired car:</p>
            <button type="button" onClick={() => setShowSketchModal(true)}>
              Open Sketch Canvas
            </button>
            {sketches.length > 0 && (
          <div style={{ marginTop: "1rem" }}>
            <h4>Sketch Previews:</h4>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {sketches.map((canvas, i) => {
                const dataUrl = canvas.toDataURL("image/png");
                return (
                  <img
                    key={i}
                    src={dataUrl}
                    alt={`Sketch ${i + 1}`}
                    width={64}
                    height={64}
                    style={{ border: "1px solid #ccc", borderRadius: 4 }}
                  />
                );
              })}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem("sketches");
            setSketches([]);
          }}
          style={{ marginTop: "1rem" }}
        >
          Clear All Sketches
        </button>
          </>
        )}

        <button type="submit" disabled={loading}>{loading ? "Processing..." : "Submit"}</button>
      </form>

      {loading && (
        <div className="progress-bar-container">
          <div className="progress-bar" />
        </div>
      )}

    {showVideo && videoUrl && (
      <div
        className="modal-overlay"
        onClick={() => setShowVideo(false)}
      >
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <video src={videoUrl} controls autoPlay loop style={{ width: "100%" }} />
          <div style={{ marginTop: "1rem", textAlign: "right" }}>
            <button onClick={() => setShowVideo(false)}>Close</button>
          </div>
        </div>
      </div>
    )}
      {videoUrl && (
        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            onClick={() => setShowVideo(true)}
            style={{ marginRight: "10px" }}
          >
            Show Video
          </button>
          <button
            type="button"
            onClick={() => {
              setVideoUrl(null);
              setShowVideo(false);
              localStorage.removeItem("generatedVideoUrl");
            }}
          >
            Remove Video
          </button>
        </div>
      )}
      {showSketchModal && (
  <div className="modal-overlay" onClick={() => setShowSketchModal(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <SketchCanvas
        onAdd={(canvas) => {
          setSketches((prev) => [...prev, canvas]);

          const dataUrl = canvas.toDataURL("image/png");
          const stored = JSON.parse(localStorage.getItem("sketches") || "[]");
          localStorage.setItem("sketches", JSON.stringify([...stored, dataUrl]));
        }}
      />
      <button onClick={() => setShowSketchModal(false)} style={{ marginTop: "1rem" }}>
        Close
      </button>
    </div>
  </div>
)}
    </div>
  );
}
