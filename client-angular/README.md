Browser testing:
'allow pasting'
ng.getComponent(document.querySelector('app-header'))
   .handleManual("get me all the products");
   
onStart() → Speech → pipeline → detectJourney() → Orders NLP
const header = ng.getComponent(document.querySelector('app-header'));
const voiceService = header['voice'];

// Simulate the microphone emitting text
voiceService['textSubject'].next("order");
voiceService['textSubject'].next("get me all the products");
voiceService['textSubject'].next("brand 3M");
voiceService['textSubject'].next("open product");

🎤 VoiceService (speech→text)
        ↓
🧠 NLP API (FastAPI → Solr)
        ↓
📦 NLP Bus (broadcast result)
        ↓
🛍️ ProductList / OrderHistory (renders + speaks)
        ↓
🔊 TtsService (reads out result)


| Page       | Voice Handler         | API Endpoint        | Bus/Event Target  | TTS Type            |
| ---------- | --------------------- | ------------------- | ----------------- | ------------------- |
| `/orders`  | `VoiceOrderService`   | `/api/orders/voice` | `OrderVoiceBus`   | `OrderTtsService`   |
| `/store/c` | `VoiceProductService` | `/products/voice`   | `ProductVoiceBus` | `ProductTtsService` |





# Angular Client Placeholder

You can generate a new Angular app with:

```
npm install -g @angular/cli
ng new client-angular
cd client-angular
ng serve --open
```

Use Web Speech API in `voice.service.ts` to capture mic input and send it to FastAPI.

D:\Demo\solr-cloud-demo\voice-ecom-demo-complete\client-angular>npm -v
10.9.2

D:\Demo\solr-cloud-demo\voice-ecom-demo-complete\client-angular>node -v
v22.17.1

ng new client-angular --skip-git --skip-tests --style=scss


Docker and K8s:
D:\Demo\repo\voice-ecom-demo-complete\client-angular>docker build -t client-angular -f docker/Dockerfile .
D:\Demo\repo\voice-ecom-demo-complete\client-angular>docker run -it --rm -p 4200:80 client-angular

or run 


docker-compose up --build


DD:\Demo\repo\voice-ecom-demo-complete\client-angular>docker tag client-angular-angular anand052021/client-angular-angular_v1

D:\Demo\repo\voice-ecom-demo-complete\client-angular>docker push anand052021/client-angular-angular_v1
Using default tag: latest
The push refers to repository [docker.io/anand052021/client-angular-angular_v1]
3d5fd375001b: Pushed
7a8a46741e18: Mounted from anand052021/client-angular-angular
cb1ff4086f82: Mounted from anand052021/client-angular-angular
da062ddf9332: Mounted from anand052021/client-angular-angular
3e5c777ae1db: Pushed
403e3f251637: Mounted from anand052021/client-angular-angular
6bc572a340ec: Mounted from anand052021/client-angular-angular
c9ebe2ff2d2c: Mounted from anand052021/client-angular-angular
3e12fa774c9e: Pushed
a992fbc61ecc: Mounted from anand052021/client-angular-angular
9adfbae99cb7: Mounted from anand052021/client-angular-angular
9824c27679d3: Mounted from anand052021/client-angular-angular
latest: digest: sha256:dd2aec1a0043fb837257880c3090b855c0384b199ae5394469ea36677d2adfaa size: 856

D:\Demo\repo\voice-ecom-demo-complete\client-angular>kubectl apply -f angular-k8s.yaml
deployment.apps/angular-app configured
service/angular-service unchanged

D:\Demo\repo\voice-ecom-demo-complete\client-angular>kubectl get pods -l app=angular-app
NAME                          READY   STATUS    RESTARTS   AGE
angular-app-5dcfdfcc6-m5fm4   1/1     Running   0          15s

D:\Demo\repo\voice-ecom-demo-complete\client-angular>kubectl logs angular-app-66b865d499-n6hqw
D:\Demo\repo\voice-ecom-demo-complete\client-angular>kubectl exec -it angular-app-66b865d499-n6hqw -- ls -l /usr/share/nginx/html

After pod restart:
kubectl get pods -l app=angular-app
kubectl exec -it <pod-name> -- ls -l /usr/share/nginx/html

openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout tls.key -out tls.crt -subj "/CN=angular-demo.local/O=angular-demo"
kubectl create secret tls angular-tls --cert=tls.crt --key=tls.key
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
kubectl get pods -n ingress-nginx
Step 2: Create an Ingress for your Angular app, Make a file angular-ingress.yaml: - i did inside docker folder
kubectl apply -f angular-ingress.yaml
Map DNS (local test) - <EXTERNAL-IP> angular.local
kubectl get svc -n ingress-nginx


if the browser thtows CORS error, try this from powershell
kubectl describe ingress fastapi-ingress -> check the annotations.

curl.exe -k -i -X OPTIONS https://api.local/query ^
  -H "Origin: https://angular-demo.local" ^
  -H "Access-Control-Request-Method: POST"

https://angular-demo.local/

Tail logs in real-time:
kubectl logs -f deployment/angular-app
kubectl logs -f deployment/fastapi-app

Stream logs from multiple pods at once (handy!)
Install stern
stern angular-app
stern fastapi-app


##############################################################

D:\Demo\repo\voice-ecom-demo-complete\client-angular>kubectl get pods -l app=angular-app
NAME                           READY   STATUS    RESTARTS   AGE
angular-app-5fb458c6f6-dz7qt   1/1     Running   0          31h

D:\Demo\repo\voice-ecom-demo-complete\client-angular>kubectl get svc angular-service
NAME              TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)   AGE
angular-service   ClusterIP   34.118.234.238   <none>        80/TCP    2d

D:\Demo\repo\voice-ecom-demo-complete\client-angular>kubectl get svc
NAME              TYPE           CLUSTER-IP       EXTERNAL-IP     PORT(S)                      AGE
angular-service   ClusterIP      34.118.234.238   <none>          80/TCP                       2d
kubernetes        ClusterIP      34.118.224.1     <none>          443/TCP                      64d
mysql             LoadBalancer   34.118.233.19    34.58.3.151     3306:32189/TCP               41d
solr1             LoadBalancer   34.118.234.163   35.223.69.124   8983:30725/TCP               47d
zoo               ClusterIP      None             <none>          2181/TCP,2888/TCP,3888/TCP   47d

D:\Demo\repo\voice-ecom-demo-complete\client-angular>kubectl get pods
NAME                           READY   STATUS    RESTARTS   AGE
angular-app-5fb458c6f6-dz7qt   1/1     Running   0          31h
mysql-648bd4d9b6-v8dp5         1/1     Running   0          7d23h
solr1-0                        1/1     Running   0          7d23h
zoo-0                          1/1     Running   0          7d23h
zoo-1                          1/1     Running   0          7d23h
zoo-2                          1/1     Running   0          7d23h

D:\Demo\repo\voice-ecom-demo-complete\client-angular>kubectl get pods -n ingress-nginx
NAME                                        READY   STATUS    RESTARTS   AGE
ingress-nginx-controller-77d6c65d95-w7t4f   1/1     Running   0          31h

D:\Demo\repo\voice-ecom-demo-complete\client-angular>kubectl get svc -n ingress-nginx
NAME                                 TYPE           CLUSTER-IP      EXTERNAL-IP      PORT(S)                      AGE
ingress-nginx-controller             LoadBalancer   34.118.238.66   35.232.141.138   80:30392/TCP,443:30857/TCP   31h
ingress-nginx-controller-admission   ClusterIP      34.118.227.92   <none>           443/TCP                      31h
##############################################################

http://localhost:4200