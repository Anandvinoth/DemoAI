import { Component, OnInit, signal,computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OpportunityService } from '../../services/opportunity.service';

@Component({
  selector: 'app-opportunity-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './opportunity-list.html',
  styleUrls: ['./opportunity-list.scss']
})
export class OpportunityListComponent implements OnInit {

  loading = signal(false);
  error = signal<string | null>(null);
  rows = signal<any[]>([]);
  count = signal(0);

  // 🔥  METRICS

totalPipeline = computed(() =>
  this.rows().reduce((sum, r) => sum + (r.amount || 0), 0)
);

atRiskCount = computed(() =>
  this.rows().filter(r => r.risk_flag === 'RED').length
);

closingThisMonth = computed(() => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  return this.rows().filter(r => {
    if (!r.expected_close_date) return false;
    const d = new Date(r.expected_close_date);
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;
});
  
  constructor(private oppService: OpportunityService) {}

  ngOnInit(): void {
    this.fetch();
  }

  fetch() {
    this.loading.set(true);
    this.error.set(null);

    this.oppService.analyticsOpportunities({
      query: "*:*",
      page: 1,
      pageSize: 20
    }).subscribe({
      next: (res: any) => {
        this.loading.set(false);

        this.rows.set(res.data || []);
        this.count.set(res.total || 0);
      },
      error: (err) => {
        console.error(err);
        this.loading.set(false);
        this.error.set("Failed to load opportunities.");
      }
    });
  }
}
