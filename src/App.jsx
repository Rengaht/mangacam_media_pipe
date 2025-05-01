import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import './App.css'

function App() {
  
  const [init, setInit] = useState(false);

  const refLastVideoTime = useRef(-1);
  const refPoseLandmarker = useRef(null);
  const refVideo=useRef();
  const refCanvas=useRef();

  async function startCamera() {
    
    try{
      const video = refVideo.current;
      
      const stream=await navigator.mediaDevices.getUserMedia({
        video: true
      });
      
      video.srcObject = stream;
      video.play();

    }catch(err){
      console.error("Error accessing camera: ", err);
    }
    
  }

  async function initMediaPipe() {
    const vision = await FilesetResolver.forVisionTasks(
      // path/to/wasm/root
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    refPoseLandmarker.current = await PoseLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: "/model/pose_landmarker_lite.task",
            // modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            // delegate: "GPU",
          },
          runningMode: 'VIDEO',
          numPoses: 2,
          outputSegmentationMasks: true,
        });
  }

  async function renderLoop() {

    const video = refVideo.current;
    // const video=document.getElementById("_capture");
    
    if (video.currentTime !== refLastVideoTime.current) {

      // try{
        if(video.readyState >= 2){
          const detections = await refPoseLandmarker.current?.detectForVideo(video, video.currentTime*1000);
          processResults(detections);
        }
        refLastVideoTime.current = video.currentTime;
      // }catch(err){
      //   console.error("Error during detection: ", err);
      // }
    }
    
    // if(!init) return;

    requestAnimationFrame(() => {
      renderLoop();
    });

  }
  function processResults(results) {
   

      if(results.landmarks){
        const landmarks = results.landmarks;
        drawLandMarks(landmarks);
        // console.log("Landmarks: ", landmarks);
        // Process landmarks here
      }
    
      if(results.segmentationMasks){
        drawMask(results.segmentationMasks[0].canvas);
      }
  }

  function drawMask(mask){
    const canvas = refCanvas.current;
    const ctx=canvas.getContext("2d");

    // const bitmap = mask.transferToImageBitmap();
    ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
  }

  function drawLandMarks(landmarks) {
    const canvas = refCanvas.current;
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawingUtils = new DrawingUtils(ctx);
    for (const landmark of landmarks){
      drawingUtils.drawLandmarks(landmark, {
        radius: (data) => DrawingUtils.lerp(data.from?.z, -0.15, 0.1, 5, 1)
      });
      drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
    }
  }
  function initDetection(){
    if(refPoseLandmarker.current){
      refPoseLandmarker.current?.close();
      setInit(false);
    }

    startCamera().then(()=>{
      initMediaPipe().then(()=>{
        console.log("MediaPipe initialized");
        setInit(true);
        
        // start render loop
        renderLoop();
        

      }).catch(err=>{
        console.error("Error initializing MediaPipe: ", err);
      });
    });

  }

  useEffect(()=>{
    initDetection();
    
  },[]);

  return (
    <div>
      <video ref={refVideo} id="_capture"></video>
      <canvas ref={refCanvas}></canvas>
      {/* <button className='absolute top-0 left-0 z-10' onClick={()=>{
        if(init){
          refPoseLandmarker.current?.close();
          refVideo.current.pause();
          setInit(false);
        }else{
          initDetection();
        }
      }}>{init?'stop':'start'}</button> */}
    </div>
  )
}

export default App
