import useStorage from '@root/src/shared/hooks/useStorage';
import OptionsClean from './OptionsClean';
import MainClean from './MainClean';
import ManualBackfillClean from './ManualBackfillClean';
import appStorage, { Page } from '@root/src/shared/storages/appStorage';

const Popup = () => {
  const storage = useStorage(appStorage);

  let page;
  if (storage.page === Page.Options) {
    page = <OptionsClean />;
  } else if (storage.page === Page.ManualBackfill) {
    page = <ManualBackfillClean />;
  } else {
    page = <MainClean />;
  }

  return (
    <div className="flex flex-col w-[480px] bg-white">
      {/* Simple Header */}
      <div className="px-5 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <img src="/icon-128.png" className="h-8 w-8" alt="logo" />
          <span className="font-bold text-gray-900 text-lg">Monarch × Amazon</span>
        </div>

        {/* Clean Tabs */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <TabButton active={storage.page === Page.Default} onClick={() => appStorage.patch({ page: Page.Default })}>
            🏠 Home
          </TabButton>
          <TabButton
            active={storage.page === Page.ManualBackfill}
            onClick={() => appStorage.patch({ page: Page.ManualBackfill })}>
            🔄 Sync
          </TabButton>
          <TabButton active={storage.page === Page.Options} onClick={() => appStorage.patch({ page: Page.Options })}>
            ⚙️ Settings
          </TabButton>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[560px]">{page}</div>
    </div>
  );
};

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
        active ? 'bg-white text-gray-900 shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}>
      {children}
    </button>
  );
}

export default Popup;
