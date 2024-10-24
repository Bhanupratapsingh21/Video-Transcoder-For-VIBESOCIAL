import { useState, useRef } from 'react';
import './App.css';
import VideoPlayer from './Videoplayer.jsx';

function App() {
  const playerRef = useRef(null);
  
  // Initial video link (default to 720p)
  const [videoLink, setVideoLink] = useState("http://localhost:4000/uploads/videos/bc984388-6f58-46c2-aeeb-d04fa3041749/240p.m3u8");

  const videoPlayerOptions = {
    controls: true,
    responsive: true,
    fluid: true,
    sources: [
      {
        src: videoLink,
        type: "application/x-mpegURL"
      }
    ]
  };

  const handlePlayerReady = (player) => {
    playerRef.current = player;

    player.on("waiting", () => {
      videojs.log("player is waiting");
    });

    player.on("dispose", () => {
      videojs.log("player will dispose");
    });
  };

  const changeResolution = (resolution) => {
    const videoId = "bc984388-6f58-46c2-aeeb-d04fa3041749";
    const newVideoLink = `http://localhost:4000/uploads/videos/${videoId}/${resolution}.m3u8`;
    
    // Update video source
    setVideoLink(newVideoLink);

    if (playerRef.current) {
      playerRef.current.src({
        src: newVideoLink,
        type: "application/x-mpegURL"
      });
      playerRef.current.play();
    }
  };

  return (
    <>
      <div>
        <h1>Video player</h1>
        <div className="resolution-buttons">
          <button onClick={() => changeResolution('240p')}>240p</button>
          <button onClick={() => changeResolution('460p')}>460p</button>
          <button onClick={() => changeResolution('720p')}>720p</button>
        </div>
      </div>
      <VideoPlayer
        options={videoPlayerOptions}
        onReady={handlePlayerReady}
      />
    </>
  );
}

export default App;
