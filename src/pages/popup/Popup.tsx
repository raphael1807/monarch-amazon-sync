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
    <div className="flex flex-col w-[420px] bg-white">
      {/* Simple Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <img src="/icon-128.png" className="h-6 w-6" alt="logo" />
          <span className="font-semibold text-gray-900 text-base">Monarch × Amazon</span>
        </div>

        {/* Clean Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <TabButton active={storage.page === Page.Default} onClick={() => appStorage.patch({ page: Page.Default })}>
            Home
          </TabButton>
          <TabButton
            active={storage.page === Page.ManualBackfill}
            onClick={() => appStorage.patch({ page: Page.ManualBackfill })}>
            Sync
          </TabButton>
          <TabButton active={storage.page === Page.Options} onClick={() => appStorage.patch({ page: Page.Options })}>
            Settings
          </TabButton>
        </div>
      </div>

      <div className="overflow-hidden">{page}</div>
    </div>
  );
};

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
      }`}>
      {children}
    </button>
  );
}

export default Popup;
