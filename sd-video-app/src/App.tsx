import { useState } from "react";
import "./App.css";

export default function VideoGenerator() {
  const [promptImage, setPromptImage] = useState<File | null>(null);
  const [cannyEdges, setCannyEdges] = useState<File[]>([]);
  const [depthMaps, setDepthMaps] = useState<File[]>([]);
  const [useCanny, setUseCanny] = useState(true);
  const [includeBackground, setIncludeBackground] = useState(true);
  const [loading, setLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const API_URL = "https://8000-01jqemr6zft7pf7d6mj4h3j4n1.cloudspaces.litng.ai/generate_video/";

  const handlePromptImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setPromptImage(event.target.files[0]);
    }
  };

  const handleGuidanceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUseCanny(event.target.value === "canny");
  };

  const handleCannyEdgesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setCannyEdges(Array.from(event.target.files));
    }
  };

  const handleDepthMapChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setDepthMaps(Array.from(event.target.files));
    }
  };

  const handleBackgroundChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setIncludeBackground(event.target.value === "with-bg");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  
    if (!promptImage || (useCanny && cannyEdges.length === 0) || (!useCanny && depthMaps.length === 0)) {
      alert("Please upload the prompt image and the selected guidance (Canny or Depth).");
      return;
    }
  
    setLoading(true);
    setVideoUrl(null);
  
    const formData = new FormData();
    formData.append("prompt_image", promptImage);
    formData.append("guidance_type", useCanny ? "canny" : "depth");
    formData.append("include_background", includeBackground ? "yes" : "no");
  
    const guidanceFiles = useCanny ? cannyEdges : depthMaps;
    guidanceFiles.forEach((file) => formData.append("guidance_files", file));
  
    try {
      const response = await fetch(`${API_URL}?nocache=${Date.now()}`, { method: "POST", body: formData });
      if (!response.ok) throw new Error("Failed to generate video");
  
      const { video_filename } = await response.json();
      const videoUrl = `https://8000-01jqemr6zft7pf7d6mj4h3j4n1.cloudspaces.litng.ai/static/${video_filename}?nocache=${Date.now()}`;
  
      setVideoUrl(videoUrl);
      setShowModal(true);
    } catch (error) {
      console.error("Error generating video:", error);
    }
  
    setLoading(false);
  };

  return (
    <div className="container">
      <h1>AutoMotion: AI-Powered Car Video Generator</h1>
      <form onSubmit={handleSubmit}>
        <label>Prompt Image:</label>
        <input type="file" accept="image/*" onChange={handlePromptImageChange} />

        <label>Guidance Type:</label>
        <div className="radio-group">
          <label><input type="radio" value="canny" checked={useCanny} onChange={handleGuidanceChange} /> Canny</label>
          <label><input type="radio" value="depth" checked={!useCanny} onChange={handleGuidanceChange} /> Depth</label>
        </div>

        {useCanny ? (
          <><label>Canny Edges:</label> <input type="file" accept="image/*" multiple onChange={handleCannyEdgesChange} /></>
        ) : (
          <><label>Depth Maps:</label> <input type="file" accept="image/*" multiple onChange={handleDepthMapChange} /></>
        )}

        <label>Include Background:</label>
        <div className="radio-group">
          <label><input type="radio" value="with-bg" checked={includeBackground} onChange={handleBackgroundChange} /> Yes</label>
          <label><input type="radio" value="without-bg" checked={!includeBackground} onChange={handleBackgroundChange} /> No</label>
        </div>

        <button type="submit" disabled={loading}>{loading ? "Generating..." : "Generate Video"}</button>
      </form>

      {loading && <p className="loading">Processing...</p>}

      {showModal && videoUrl && (
        <div className="modal" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <video src={videoUrl} controls autoPlay loop style={{ width: "100%" }} />
            <button onClick={() => setShowModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
