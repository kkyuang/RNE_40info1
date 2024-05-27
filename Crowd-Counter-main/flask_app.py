from time import sleep
from flask import Flask, render_template, request, send_file
from werkzeug.utils import secure_filename
from werkzeug.datastructures import  FileStorage
import cv2
import os
import glob
import requests
import inference_flask as util
app = Flask(__name__)

model, transform, device = util.load_model()

@app.route('/')
def r_upload_file():
   return render_template('upload.html')

@app.route('/image', methods = ['GET', 'POST'])
def image():
   global model, transform, device
   for file in glob.glob('./*'):
      if file.endswith('.jpg') or file.endswith('.png') or file.endswith('jpeg'):
         os.remove(file)
   if request.method == 'POST':
      f = request.files['file']
      f.save(secure_filename(f.filename))
      # inference
      count = util.image_inference(model, transform, device, secure_filename(f.filename))

      data = {
         'map_name': request.form['map-name'],
         'areaId': request.form['area-id'],
         'crowdCount': count
      }
      print(request.form['map-name'])
      print(request.form['area-id'])
      url='http://localhost:8080/update-crowd/' + request.form['map-name']
     
      print( requests.post(url, data))
      return render_template('result.html', **data)

@app.route('/video', methods = ['GET', 'POST'])
def video():
   global model, transform, device
   for file in glob.glob('./*'):
      if file.endswith('.mp4') or file.endswith('.avi'):
         os.remove(file)
   if request.method == 'POST':
      f = request.files['file']
      f.save(secure_filename(f.filename))
      # inference
      util.video_inference(model, transform, device, secure_filename(f.filename))
      return send_file(secure_filename(f.filename)+'.avi')
		
if __name__ == '__main__':
   app.run(debug = True)