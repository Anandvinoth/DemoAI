# train_intent_model.py — dynamic Solr-driven intent training

import os, random, numpy as np, torch
from datasets import Dataset
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score
from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification, TrainingArguments, Trainer
from attribute_loader import load_facet_values,load_order_facets

# --- Setup ---
MAX_VALUES_PER_FIELD = int(os.getenv("MAX_VALUES_PER_FIELD", "10"))
RANDOM_SEED = 42
random.seed(RANDOM_SEED)
np.random.seed(RANDOM_SEED)
torch.manual_seed(RANDOM_SEED)
torch.set_num_threads(2)

# --- Discover attributes from Solr ---
attrs = load_facet_values() or {}
PREFERRED_ORDER = ["brand","category","color","material","name","styleName","styleId","productType"]
fields_sorted = [f for f in PREFERRED_ORDER if f in attrs] + [f for f in attrs.keys() if f not in PREFERRED_ORDER]

if not fields_sorted:
    attrs = {
        "brand": ["Bosch","DeWalt","Makita"],
        "category": ["Power Tools","Hand Tools"],
        "color": ["Blue","Black"],
        "material": ["Steel","Aluminum"],
        "name": ["Industrial Drill"],
    }
    fields_sorted = list(attrs.keys())

def label_for(field:str)->str:
    return f"search_by_{field}"

# --- Generate utterances ---
def gen_templates(field:str,value:str):
    f = field.replace("_"," ")
    v = value
    field_plural = f if f.endswith("s") else f+"s"
    value_plural = v if v.endswith("s") else v+"s"
    action_words = ["show","show me","find","find me","get","display","list","browse","fetch","give me","I want"]
    templates=[]
    for a in action_words:
        templates += [
            f"{a} {v}", f"{a} {f} {v}", f"{a} {value_plural}", f"{a} {field_plural} {v}",
            f"{a} all {field_plural}", f"{a} all {v}", f"{a} products in {v}",
            f"{a} products in {field_plural}", f"{a} all products in {v}",
            f"{a} {field_plural} like {v}", f"{a} {v} category"
        ]
    templates += [
        f"I want to see {v}", f"Do you have {v}", f"I’m looking for {v}",
        f"Show available {field_plural}", f"List {v} items", f"List all {v} products"
    ]
    return templates

def gen_price_examples():
    ex,lab=[],[]
    under=[50,100,200,500]; over=[50,100,200,500,1000]; between=[(50,100),(100,200),(200,400),(400,800)]
    for n in under:
        ex.append(f"show products under {n}"); lab.append("search_by_price_max")
        ex.append(f"below {n} price"); lab.append("search_by_price_max")
    for n in over:
        ex.append(f"show products above {n}"); lab.append("search_by_price_min")
        ex.append(f"greater than {n}"); lab.append("search_by_price_min")
    for lo,hi in between:
        ex.append(f"between {lo} and {hi}"); lab.append("search_by_price_between")
        ex.append(f"price from {lo} to {hi}"); lab.append("search_by_price_between")
    return ex,lab

examples_text,examples_label=[],[]

# --- Generate facet-based utterances ---
for field in fields_sorted:
    values = attrs.get(field,[])[:MAX_VALUES_PER_FIELD]
    values=[v for v in values if isinstance(v,str) and v.strip()]
    if not values: continue
    lab=label_for(field)
    for v in values:
        for utt in gen_templates(field,v):
            examples_text.append(utt)
            examples_label.append(lab)

# --- Price examples ---
ex_p,lab_p = gen_price_examples()
examples_text += ex_p
examples_label += lab_p

# --- Order facets ---

order_attrs = load_order_facets() or {}
print(f"[INFO] Loaded {len(order_attrs)} order facet fields: {list(order_attrs.keys())}")

for field, values in order_attrs.items():
    values = [v for v in values if isinstance(v, str) and v.strip()]
    if not values:
        continue
    lab = f"filter_by_{field}"
    for v in values[:MAX_VALUES_PER_FIELD]:
        for utt in gen_templates(field, v):
            examples_text.append(utt)
            examples_label.append(lab)
            
print(f"[DEBUG] Added {len(examples_text)} total examples so far.")
print("Sample order utterances:", [t for t in examples_text if "currency" in t.lower()][:5])

# --- “Browse all” intent examples ---
browse_examples = [
    ("show all products","search_by_all_products"),
    ("list all products","search_by_all_products"),
    ("show everything","search_by_all_products"),
    ("go back to products","search_by_all_products"),
    ("back to catalog","search_by_all_products"),
    ("products", "search_by_all_products"),
    ("go to products", "search_by_all_products"),
    ("take me to products", "search_by_all_products"),
    ("product catalog", "search_by_all_products"),
    ("browse products", "search_by_all_products"),
]

for txt,lab in browse_examples:
    examples_text.append(txt); examples_label.append(lab)

# --- Order intents ---
order_examples = [
    ("show my orders","view_orders"),
    ("show all orders", "view_all_orders"),
    ("filter by currency usd", "filter_orders"),
    ("filter by payment status returned", "filter_orders"),
    ("filter by status shipped", "filter_orders"),
    ("filter by currency cad", "filter_orders"),
    ("get my order history","view_orders"),
    ("list my recent orders","view_orders"),
    ("show all orders","view_all_orders"),
    ("display all customer orders","view_all_orders"),
    
    ("go to orders", "view_orders"),
    ("take me to orders", "view_orders"),
    ("orders", "view_orders"),
    ("open my orders", "view_orders"),
    ("get my orders", "view_orders"),

    ("go to all orders", "view_all_orders"),
    ("open all customer orders", "view_all_orders"),
]
for txt,lab in order_examples:
    examples_text.append(txt); examples_label.append(lab)

# --- Encode labels ---
labels_unique = sorted(set(examples_label))
label2id = {l:i for i,l in enumerate(labels_unique)}
id2label = {i:l for l,i in label2id.items()}
print(f"[INFO] Labels: {labels_unique}")

# --- Tokenize ---
tokenizer = DistilBertTokenizerFast.from_pretrained("distilbert-base-uncased")
model = DistilBertForSequenceClassification.from_pretrained(
    "distilbert-base-uncased", num_labels=len(labels_unique),
    id2label=id2label, label2id=label2id
)

X=examples_text; y=[label2id[l] for l in examples_label]
train_texts,val_texts,train_labels,val_labels=train_test_split(X,y,test_size=0.2,random_state=RANDOM_SEED,stratify=y)
train_dataset=Dataset.from_dict({"text":train_texts,"label":train_labels})
val_dataset=Dataset.from_dict({"text":val_texts,"label":val_labels})
def tokenize(batch): return tokenizer(batch["text"],padding=True,truncation=True)
train_dataset=train_dataset.map(tokenize,batched=True)
val_dataset=val_dataset.map(tokenize,batched=True)

def compute_metrics(eval_pred):
    try:
        logits,labels=eval_pred
        preds=np.argmax(logits,axis=1)
        return {"f1":float(f1_score(labels,preds,average="weighted"))}
    except Exception: return {"f1":0.0}

args=TrainingArguments(
    output_dir="./intent_model",evaluation_strategy="epoch",
    num_train_epochs=2,per_device_train_batch_size=8,per_device_eval_batch_size=8,
    learning_rate=5e-5,logging_dir="./logs",no_cuda=True,report_to="none"
)

trainer=Trainer(model=model,args=args,train_dataset=train_dataset,
                eval_dataset=val_dataset,tokenizer=tokenizer,
                compute_metrics=compute_metrics)
trainer.train()
os.makedirs("./intent_model",exist_ok=True)
trainer.save_model("./intent_model")
tokenizer.save_pretrained("./intent_model")
print(f"[OK] Saved intent model with {len(labels_unique)} labels.")
