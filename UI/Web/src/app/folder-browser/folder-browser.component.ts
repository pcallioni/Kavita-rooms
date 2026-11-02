import {ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal} from '@angular/core';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {takeUntilDestroyed, toSignal} from '@angular/core/rxjs-interop';
import {map} from 'rxjs';
import {Library} from '../_models/library/library';
import {Series} from '../_models/series';
import {LibraryService} from '../_services/library.service';
import {SeriesService} from '../_services/series.service';
import {FilterV2} from '../_models/metadata/v2/filter-v2';
import {SeriesFilterField} from '../_models/metadata/v2/series-filter-field';
import {FilterComparison} from '../_models/metadata/v2/filter-comparison';
import {FilterCombination} from '../_models/metadata/v2/filter-combination';
import {FilterEntityType} from '../_models/metadata/v2/filter-entity-type';
import {SeriesCardComponent} from '../cards/series-card/series-card.component';
import {SideNavCompanionBarComponent} from '../sidenav/_components/side-nav-companion-bar/side-nav-companion-bar.component';
import {LoadingComponent} from '../shared/loading/loading.component';

interface FolderEntry {
  name: string;
  /** Path relative to the library root, used in the url */
  path: string;
  /** Books in this folder and all folders below */
  count: number;
}

interface Crumb {
  name: string;
  path: string;
}

const collator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});

function normalize(path: string | null | undefined): string {
  return (path ?? '').replace(/\\/g, '/').replace(/\/+$/, '');
}

/**
 * Variante Cartelle: browse a library by its folders, like a file manager.
 * Folders come from the folder of each series, so only folders that hold books are shown.
 */
@Component({
  selector: 'app-folder-browser',
  templateUrl: './folder-browser.component.html',
  styleUrls: ['./folder-browser.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, SeriesCardComponent, SideNavCompanionBarComponent, LoadingComponent],
})
export class FolderBrowserComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly libraryService = inject(LibraryService);
  private readonly seriesService = inject(SeriesService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly libraryId = Number(
    this.route.snapshot.paramMap.get('libraryId') ?? this.route.parent?.snapshot.paramMap.get('libraryId') ?? 0);

  protected readonly library = signal<Library | undefined>(undefined);
  protected readonly allSeries = signal<Series[]>([]);
  protected readonly loading = signal(true);

  /** Current folder, relative to the library root ('' = root) */
  protected readonly currentPath = toSignal(
    this.route.queryParamMap.pipe(map(p => normalize(p.get('path')).replace(/^\/+/, ''))),
    {initialValue: ''});

  /** Every series with its folder relative to the library root */
  private readonly located = computed(() => {
    const roots = this.roots();
    return this.allSeries().map(series => ({series, folder: this.relativeFolder(series, roots)}));
  });

  /** Library root folders; non admins do not receive them, then the common folder of all series is used */
  private readonly roots = computed(() => {
    const folders = (this.library()?.folders ?? []).map(normalize).filter(f => f.length > 0);
    if (folders.length > 0) return folders.sort((a, b) => b.length - a.length);

    const paths = this.allSeries().map(s => normalize(s.folderPath)).filter(p => p.length > 0);
    if (paths.length === 0) return [];
    let common = paths[0].split('/');
    for (const p of paths) {
      const parts = p.split('/');
      let i = 0;
      while (i < common.length && i < parts.length && common[i] === parts[i]) i++;
      common = common.slice(0, i);
    }
    return [common.join('/')];
  });

  protected readonly folders = computed<FolderEntry[]>(() => {
    const current = this.currentPath();
    const prefix = current === '' ? '' : current + '/';
    const counts = new Map<string, number>();
    for (const {folder} of this.located()) {
      if (folder === null || !folder.startsWith(prefix) || folder === current) continue;
      const name = folder.substring(prefix.length).split('/')[0];
      if (name === '') continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({name, count, path: prefix + name}))
      .sort((a, b) => collator.compare(a.name, b.name));
  });

  protected readonly seriesHere = computed(() => {
    const current = this.currentPath();
    return this.located()
      .filter(l => l.folder === current)
      .map(l => l.series)
      .sort((a, b) => collator.compare(a.sortName || a.name, b.sortName || b.name));
  });

  protected readonly crumbs = computed<Crumb[]>(() => {
    const parts = this.currentPath().split('/').filter(p => p.length > 0);
    return parts.map((name, i) => ({name, path: parts.slice(0, i + 1).join('/')}));
  });

  constructor() {
    this.libraryService.getLibrary(this.libraryId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({next: lib => this.library.set(lib), error: () => {}});
    this.loadSeries();
  }

  loadSeries() {
    this.loading.set(true);
    const filter: FilterV2<SeriesFilterField> = {
      statements: [{field: SeriesFilterField.Libraries, value: this.libraryId + '', comparison: FilterComparison.Equal}],
      combination: FilterCombination.And,
      entityType: FilterEntityType.Series,
      limitTo: 0,
    };

    this.seriesService.getSeriesForLibraryV2(undefined, undefined, filter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.allSeries.set(result.result ?? []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private relativeFolder(series: Series, roots: string[]): string | null {
    const folder = normalize(series.lowestFolderPath || series.folderPath);
    if (folder === '') return null;
    for (const root of roots) {
      if (folder === root) return '';
      if (folder.startsWith(root + '/')) return folder.substring(root.length + 1);
    }
    return null;
  }
}
