http://localhost:4200/
http://localhost:8000/docs#/default/query_query_post

########################################################
“Show my delivered orders last month over $500”
“Show open orders for account ACC1021 this quarter”
“Show all orders except canceled”
“Filter orders by warehouse pending status”
“Show orders for account Mohawk Canada”
| Voice Input                 | Intent                    | Solr FQ                 |
| --------------------------- | ------------------------- | ----------------------- |
| “show products under 50”    | `search_by_price_max`     | `price:[0 TO 50]`       |
| “price less than 25”        | `search_by_price_max`     | `price:[0 TO 25]`       |
| “price above 300”           | `search_by_price_min`     | `price:[300 TO 999999]` |
| “price between 100 and 250” | `search_by_price_between` | `price:[100 TO 250]`    |
| “back to products”          | `browse_all`              | `q=*:*`                 |


| Speech → Intent           | Entities                | Action       |
| ------------------------- | ----------------------- | ------------ |
| “show all orders”         | `{super_user:true}`     | fetch all    |
| “show my orders”          | `{account_id:ACC1021}`  | fetch mine   |
| “orders pending delivery” | `{status:'In Transit'}` | filter       |
| “orders by Hitachi”       | `{brand:'Hitachi'}`     | facet filter |
| Analytics Need                       | Query                        |
| ------------------------------------ | ---------------------------- |
| “Top 10 products sold this month”    | Facet on product_id          |
| “Revenue by category”                | Group on category            |
| “Average order size and price trend” | Group by month on order_date |
| “Which products get returned most?”  | Join + order status filters  |
TODO 
Frequent purchase patterns
RFM scoring (Recency, Frequency, Monetary)
Product affinity for cross-sell

| Step | Module                            | Description                                                                                                                                                 |
| ---- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1️⃣  | **`attribute_loader.py`**         | Loads all order facets dynamically (status, payment_status, currency, etc.) so the model knows what words matter.                                           |
| 2️⃣  | **`train_intent_model.py`**       | Generates training examples like “show pending orders”, “filter by currency USD”, “orders in CAD” → trains labels `search_by_status`, `search_by_currency`. |
| 3️⃣  | **`nlu_engine.py`**               | Uses the trained model to detect intent + entities at runtime (e.g. `intent=search_by_currency`, `entities={"currency": "USD"}`).                           |
| 4️⃣  | **`order_voice.py`**              | Simply interprets those entities → builds proper Solr filters dynamically.                                                                                  |
| 5️⃣  | **`solr_voice_order_service.py`** | Executes the Solr query with FQ filters.                                                                                                                    |

normalize_text() → cleans up the raw voice text
(removes filler words, fixes mishears, applies phonetic corrections).

classify_intent() → runs your DistilBERT model to predict what the user wants
(e.g., filter_by_currency, view_all_orders, search_by_price_max, etc.).

extract_entities() → pulls out structured entities
(e.g., { "currency": "USD", "status": "Returned", "account_id": "ACC1027" }).


🎙 Voice in Browser
  ↓
Angular: POST /query
  ↓
FastAPI NLU → Intent/Entities
  ↓
FastAPI executes business logic
  ↓
FastAPI returns final response (orders or products)
  ↓
Angular shows UI + TTS feedback

########################################################

cd /Users/e221137/Official/personal/Demo/DemoAI/server-fastapi

cd server-fastapi
python -m venv venv
source venv/bin/activate     # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
Installed Python-3.11.8 to /Users/e221137/.pyenv/versions/3.11.8    ############

Docker and K8s:
# Build
docker-compose build

# Start
docker-compose up
docker compose up -d --build fastapi
D:\Demo\repo\voice-ecom-demo-complete\server-fastapi>
docker build -t client-fastapi -f docker/Dockerfile .
docker tag server-fastapi-fastapi anand052021/server-fastapi-fastapi
docker push anand052021/server-fastapi-fastapi

created below files inside docker/
fastapi-k8s.yaml
fastapi-ingress.yaml

Deploy to K8s:
kubectl apply -f fastapi-k8s.yaml
kubectl apply -f fastapi-ingress.yaml

https://api.local/docs
35.232.141.138 api.local

D:\Demo\repo\voice-ecom-demo-complete\server-fastapi>git branch -M master
git branch -vv
git status D:\Demo\repo\k8s - To check the status of that folder alone
D:\Demo\repo\voice-ecom-demo-complete\server-fastapi>git add docker-compose.yml
D:\Demo\repo\voice-ecom-demo-complete\server-fastapi>git add docker
D:\Demo\repo\voice-ecom-demo-complete\server-fastapi>git commit -m "Updated NLP service and README files, removed unused files"
D:\Demo\repo\voice-ecom-demo-complete\server-fastapi>git push origin master



Yes, using **Hugging Face Transformers + spaCy + FastAPI** is **completely open source** and can run **on-premises** or in the **cloud**. It's ideal for enterprise-grade, privacy-aware voice applications. Let’s compare the two approaches in detail:

---

## 🆚 Dialogflow vs Open Source NLP (Hugging Face + spaCy + FastAPI)

| Feature               | **Dialogflow** (Google)                                   | **Open Source NLP (Transformers + spaCy + FastAPI)** |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| **License**           | Proprietary (Free tier available, paid usage above quota) | 100% Open Source (Apache 2.0, MIT, etc.)             |
| **Hosting**           | Cloud-only (Google Cloud)                                 | On-prem or any cloud (AWS, Azure, GCP, etc.)         |
| **Ease of Setup**     | Easy GUI setup                                            | Requires initial engineering effort                  |
| **Customization**     | Limited – model tuning is abstracted away                 | Full control – use, train, or fine-tune any model    |
| **NLU Quality**       | Good for general intents                                  | Equal or better with the right model                 |
| **Privacy**           | Voice/data goes to Google servers                         | Everything stays within your infrastructure          |
| **Multi-language**    | Built-in support                                          | Supported via spaCy or multilingual transformers     |
| **Voice Integration** | Native to Google Assistant                                | You manage Speech-to-Text integration manually       |
| **Extensibility**     | Limited to what's supported by Dialogflow                 | Fully programmable (Python ecosystem)                |
| **Cost**              | Free tier → Paid as usage grows                           | Free unless you use managed GPU/Cloud services       |

---

## ✅ Pros of the Open Source Approach

1. **Enterprise Privacy**: No external data transmission (HIPAA/GDPR friendly).
2. **Model Ownership**: You own and control model behavior and evolution.
3. **Flexibility**: Add any ML/NLP library or service (OpenAI, LangChain, etc.).
4. **Zero Lock-in**: Can switch infrastructure (cloud/on-prem) anytime.
5. **Advanced AI**: Use state-of-the-art models like `bert-base`, `roberta`, `llama`, or even private LLMs.
| Model        | Type           | Developed By    | Purpose                 |
| ------------ | -------------- | --------------- | ----------------------- |
| `bert-base`  | Text encoder   | Google          | Text understanding      |
| `roberta`    | Text encoder   | Facebook (Meta) | Improved BERT           |
| `llama`      | Text generator | Meta            | Full LLM for generation |
| Private LLMs | Any            | Custom          | Specialized/private use |

---

## ⚠️ Cons of the Open Source Approach

1. **Higher Initial Setup**: Needs Python, model selection, possibly training.
2. **Maintenance Required**: You must monitor and retrain models as needed.
3. **No GUI**: Unlike Dialogflow’s flow builder, logic is built in code.

---

## 🧠 When to Choose Which?

| Use Case                     | Recommended |
| ---------------------------- | ----------- |
| Rapid prototyping            | Dialogflow  |
| Enterprise-grade product     | Open Source |
| Privacy-sensitive data       | Open Source |
| Fine-grained control of NLP  | Open Source |
| Google Assistant integration | Dialogflow  |

---

Would you like me to now:

* Create a working backend with Hugging Face + spaCy replacing Dialogflow, and
* Add it to your `server-fastapi/` folder?

Let me know if you prefer English-only intents or multilingual (we can easily support both).

| Package        | Purpose                                             |
| -------------- | --------------------------------------------------- |
| `fastapi`      | Lightweight, async API server                       |
| `uvicorn`      | ASGI server to run FastAPI                          |
| `transformers` | Hugging Face model loading & inference              |
| `torch`        | Backend for transformer models                      |
| `spacy`        | Named entity recognition (NER) and language parsing |
| `langdetect`   | Detects the language of the user's input            |
| 'Httpx'		 | httpx is a modern HTTP client for Python	           |
				   Async HTTP client (used for APIs, not models)	   |
				   
| Tool             | Can be "called like BERT"? | What it is / Does                                      |
| ---------------- | -------------------------- | ------------------------------------------------------ |
| **FastAPI**      | ❌ No                       | Web API framework (Python)                             |
| **Uvicorn**      | ❌ No                       | ASGI server for running FastAPI apps                   |
| **Transformers** | ✅ Yes ✔️                   | Library that provides `bert-base` and other models     |
| **Torch**        | ✅ Indirectly ✔️            | Backend library (PyTorch) used by `transformers`       |
| **SpaCy**        | ✅ Kind of ✔️               | NLP library with its own models, not Hugging Face ones |
| **Langdetect**   | ❌ No                       | Lightweight language detection library                 |
| **HTTPX**        | ❌ No                       | Async HTTP client (used for APIs, not models)          |


| Model Name                                     | Description                      | Pros                      | Cons                    |
| ---------------------------------------------- | -------------------------------- | ------------------------- | ----------------------- |
| `facebook/bart-large-mnli`                     | Standard, robust model           | Accurate, multilingual    | Large (slow on CPU)     |
| `joeddav/xlm-roberta-large-xnli`               | Multilingual zero-shot           | Works with 100+ languages | Slower, large           |
| `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli` | More accurate, smaller than BART | Better performance        | Not multilingual        |
| `openai/clip-vit-base-patch16`                 | Zero-shot for image + text       | Multimodal (image + text) | Not text-only use       |
| Fine-tuned `distilbert-mnli`                   | Smaller, faster                  | Lightweight               | Less accurate than BART |


#########################################################ETL insert update fix##########################################################################
ETL successfully loads historical orders into Solr, we’ll build the real-time sync pipeline using Celery + FastAPI + MySQL + Solr — so new or updated orders get indexed automatically.

ARCHITECTURE OVERVIEW

FastAPI (Order Service)
   |
   ├── POST /orders → writes to MySQL
   │
   └── Celery task.delay(order_id)
        |
        ├── Fetch order_header + order_items from MySQL
        ├── Build Solr document JSON
        └── POST to Solr /update?commitWithin=2000 (async)

Step 1. Install Dependencies - 
pip install celery redis httpx mysql-connector-python
Run Redis Locally, not in docker :
brew install redis
brew services start redis
To check if its running or not: redis-cli ping
Start Celery Worker: cd /Users/e221137/Official/personal/Demo/DemoAI/server-fastapi
celery -A celery_app.celery_app worker --loglevel=info
to check : celery -A celery_app.celery_app inspect ping

1) Start Redis - e221137@odolapdhcvln3 server-fastapi % redis-server
2) Start Celery worker - e221137@MACYC2QYKFWP4 server-fastapi % celery -A celery_app.celery_app worker --loglevel=info
3) Add Flower — Celery Web Dashboard - e221137@MACYC2QYKFWP4 server-fastapi % celery -A celery_app.celery_app flower --port=5555
4) Run FastAPI - uvicorn main:app --reload --port 8000
5) Call your endpoint:

Optional: Add Flower — Celery Web Dashboard:
    pip install flower
    celery -A celery_app.celery_app flower --port=5555
    http://localhost:5555
Enable Unauthenticated API (local development):
    export FLOWER_UNAUTHENTICATED_API=true
    celery -A celery_app.celery_app flower --port=5555
    
Restart everything cleanly:####################################
    pkill -f 'celery'
    brew services restart redis  # if using Homebrew
    redis-cli ping  # should return PONG
    export PYTHONPATH=$(pwd)
    celery -A celery_app.celery_app worker --loglevel=info
##############################################################

Local FastAPI + Redis + Celery Architecture
FastAPI (localhost:8000)
   │
   └──> Celery (localhost:5555 for monitoring if you add Flower)
        │
        └──> Redis (localhost:6379)

FastAPI → puts job in queue
Celery → picks up job, runs it
Redis is the message broker — it’s the “middleman” between FastAPI and Celery.
    It temporarily stores the task messages (like “index order ORD1001”) until Celery workers pick them up.
    It’s basically a super-fast in-memory database for messages.

How They Work Together (Simple Flow Diagram):
FastAPI App (Publisher)
   │
   │   send task → Celery.enqueue("index_order_in_solr", order_id="ORD1001")
   ▼
Redis (Message Broker)
   │
   │   stores "pending" tasks temporarily
   ▼
Celery Worker (Consumer)
   │
   │   fetches the task → executes it (e.g., fetch MySQL → POST to Solr)
   ▼
Solr (Final target)


###############################################################ETL insert update fix####################################################################