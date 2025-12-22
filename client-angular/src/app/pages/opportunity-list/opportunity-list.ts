import { Component, OnInit, signal } from '@angular/core';
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

  constructor(private oppService: OpportunityService) {}

  ngOnInit(): void {
    this.fetch();
  }

  fetch() {
    this.loading.set(true);
    this.error.set(null);

    this.oppService.listOpportunities()
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.count.set(res.count);
          this.rows.set(res.results || []);
        },
        error: (err) => {
          console.error(err);
          this.loading.set(false);
          this.error.set("Failed to load opportunities.");
        }
      });
  }
}
