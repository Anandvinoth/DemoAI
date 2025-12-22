// src/app/pages/product-list/product-list.ts
import { Component, OnInit, OnDestroy, signal, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, filter } from 'rxjs';

import { NlpBus, NlpEvent } from '../../services/nlp-bus';
import { NlpApiService, ProductSearchRequest } from '../../services/nlp-service';
import { VoiceService } from '../../services/voice-service';
import { TtsService } from '../../services/tts.service';
import { VoiceContextService } from '../../services/voice/voice-context.service';


import { Router } from '@angular/router';
import { Product } from '../../models/product';
import { NlpResponse } from '../../models/nlp.response';

type ProductDetailPayload = NlpEvent & {
  action?: string;      // e.g. "open_detail"
  product_id?: string;  // optional explicit product id
  index?: number;       // optional index in the list (0-based)
};

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-list.html',
  styleUrls: ['./product-list.scss']
})
export class ProductList implements OnInit, OnDestroy {
    
  // ───────────────────────────────────────────────────────────────
  //  Injected services
  // ───────────────────────────────────────────────────────────────
  private bus = inject(NlpBus);
  private api = inject(NlpApiService);
  private voice = inject(VoiceService);
  private tts = inject(TtsService);
  private router = inject(Router);
    
  private sub?: Subscription;
    
//  constructor() {
//      console.log('🔥 ProductList CONSTRUCTOR');
//    }
  constructor(private voiceCtx: VoiceContextService) {
    console.log('🔥 ProductList CONSTRUCTOR');
    this.voiceCtx.setMode('products');
  }
    
  trackById(index: number, product: any) {
      return product?.id ?? index;
    }

  get selectedKeys() {
      return Object.keys(this.selected());
  }
  
  isSelectedActive(facetKey: string, itemName?: string, itemRange?: string): boolean {
      const arr = this.selected()[facetKey];
      const value = itemName || itemRange || '';
      return Array.isArray(arr) && arr.includes(value);
   }

  //@ViewChild(ProductChooser) chooser?: ProductChooser;

  // ───────────────────────────────────────────────────────────────
  //  Signals (UI state)
  // ───────────────────────────────────────────────────────────────
  products    = signal<Product[]>([]);
  facets      = signal<any>({});
  facetsList  = signal<any[]>([]);
  selected    = signal<Record<string, string[]>>({});

  lastQuery   = signal<string>('');
  page        = signal<number>(1);
  pageSize    = signal<number>(20);

  chooserVisible = signal<boolean>(false);

  // ───────────────────────────────────────────────────────────────
  ngOnInit() {
    console.log('🔥 ProductList INIT');
    console.log('######Subscribing in#######', this.constructor.name);
    // Listen ONLY for NLP events targeted to products
    this.sub = this.bus.events$
      .pipe(filter((ev: NlpEvent) => ev.target === 'products'))
      .subscribe((ev: NlpEvent) => {
      console.log(this.constructor.name + ' received products event:', ev);
      //console.trace("Stack trace for subscriber");
      this.handleNlpEvent(ev);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.voice.unmuteToApi();     // always restore mic state
  }

  // =====================================================================
  //  SECTION A — NLP EVENT HANDLING
  // =====================================================================
  private handleNlpEvent(nlp: NlpEvent) {
  if (!nlp) return;
  console.log("handleNlpEvent method product-list.ts!!!!!!!!!!!!!!!!!!!!!!!!!! : " + this.router.url);
  
  const res = nlp as NlpResponse;
      
  if (nlp.intent === '__reset__') {
    console.log("🔄 Reset event → ignoring");
    return;
   }

  // 🔹 1) Product DETAIL response → open detail page
  if (res.intent === 'product_detail' && res.product) {
    console.log("🟢 Product detail intent received, opening detail page");

    const p = res.product as Product;

    // keep internal state consistent
    this.products.set([p]);

    this.openProduct(p);
    return; // skip list logic
  }

  // 🔹 2) Normal LIST response (what you already had)
  this.lastQuery.set(res.solr_query ?? res.input ?? '');

  this.products.set(res.products ?? []);
  const count = this.products().length;

  const f = res.facets ?? {};
  this.facets.set(f);
  this.facetsList.set(
    Object.keys(f).map(key => ({
      key,
      values: f[key]
    }))
  );

  this.page.set(res.page ?? 1);
  this.pageSize.set(res.pageSize ?? this.pageSize());

  this.chooserVisible.set(count >= 2 && count <= 3);

  console.log("product-list.ts calling handleTTS method!!!!!!!!!!!!!!!!");
  this.handleTTS(count);
}


  // =====================================================================
  //  SECTION B — FILTERS + FACET CLICK + CHIP REMOVAL + CLEAR
  // =====================================================================
  onFacetClick(key: string, item: { name?: string; range?: string }) {
    const value = item.name ?? item.range;
    if (!value) return;

    const cur = { ...this.selected() };
    const arr = [...(cur[key] ?? [])];

    // toggle
    const idx = arr.indexOf(value);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(value);

    if (arr.length) cur[key] = arr;
    else delete cur[key];

    this.selected.set(cur);
    this.fetchWithFilters();
  }

  removeChip(key: string, value: string) {
    const cur = { ...this.selected() };
    const arr = (cur[key] ?? []).filter(v => v !== value);
    if (arr.length) cur[key] = arr;
    else delete cur[key];
    this.selected.set(cur);
    this.fetchWithFilters();
  }

  clearAllFilters() {
    this.selected.set({});
    this.fetchWithFilters();
  }

  private fetchWithFilters() {
    const body: ProductSearchRequest = {
      query: this.lastQuery() || '*:*',
      filters: this.selected(),
      page: 1,
      pageSize: this.pageSize()
    };

    this.api.searchProducts(body).subscribe({
      next: (nlp: any) => this.handleNlpEvent({ ...nlp, target: 'products' }),
      error: err => console.error('❌ Product facet search failed', err)
    });
  }

  // =====================================================================
  //  SECTION C — TTS LOGIC (clean + readable)
  // =====================================================================
  private async handleTTS(count: number) {
  const products = this.products();

  // Nothing found
  if (count === 0) {
    await this.tts.speakWhenIdle("I couldn't find any matching products.");
    this.voice.unmuteToApi();
    return;
  }

  // Build dynamic list like: "1. Drill, 2. Saw, 3. Press"
  const maxToRead = Math.min(count, 3);
  const names = products
    .slice(0, maxToRead)
    .map((p, i) => `${i + 1}. ${p.name}`)
    .join(", ");

  // Dynamic choice options (first → up to third)
  //const ordinalWords = ["first", "second", "third"];
  //const choiceText = ordinalWords.slice(0, maxToRead).join(", ").replace(/,([^,]*)$/, " or$1");

  // Single message builder (handles ALL cases)
  let message = "";

  if (count === 1) {
    // One product → natural conversation
    message = `I found one product: ${products[0].name} by ${products[0].brand}.`;
  } else if (count <= 3) {
    // 2 or 3 products → read all, then prompt
    console.log("######## found <=3 products #########");
    message = `I found ${count} products in total.'; ${names}.`;
    //message = `I found ${count} products in total.'; ${names}. Say ${choiceText} to choose.`;
  } else {
    // More than 3 → top 3
    //message = `I found ${count} results Top ${maxToRead}: ${names}. Say ${choiceText} to choose.`;
    message = `I found ${count} products in total.`;
  }

  await this.tts.speakWhenIdle(message);
  this.voice.unmuteToApi();
}


  // =====================================================================
  //  OPEN PRODUCT → NAVIGATE TO DETAIL PAGE
  // =====================================================================
  openProduct(product: Product) {
    this.tts.stop();
    this.voice.unmuteToApi();
    this.chooserVisible.set(false);

    this.router.navigate(
      ['/product-detail'],
      { state: { product } }
    );
  }

  onChosenProduct(p: Product) {
    this.chooserVisible.set(false);
    this.voice.unmuteToApi();
    this.openProduct(p);
  }

  onChooserClosed() {
    this.chooserVisible.set(false);
    this.voice.unmuteToApi();
  }

  onChooserSeeAll() {
    this.chooserVisible.set(false);
    this.voice.unmuteToApi();
  }
}
