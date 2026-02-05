import { Routes } from '@angular/router';
import { ProductList } from './pages/product-list/product-list';
import { ProductDetail } from './pages/product-details/product-details';
import { OrderHistory } from './pages/order-history/order-history';
import { OpportunityCreateComponent } from './pages/opportunity-create/opportunity-create';
import { OpportunityListComponent } from './pages/opportunity-list/opportunity-list';
import { AssistantPage } from './pages/assistant/assistant.page';

export const routes: Routes = [
    { path: '', redirectTo: 'assistant', pathMatch: 'full' },   
    { path: 'assistant', component: AssistantPage},
    {path: 'store/c', component: ProductList},
    {path: 'product-detail', component:ProductDetail},
    {path: 'orders', component: OrderHistory},
    // {path: 'crm/opportunities',component: OpportunityCreateComponent},
    {path: 'crm/opportunities/create',component: OpportunityCreateComponent},
    {path: 'crm/opportunities/list',component: OpportunityListComponent}
];
