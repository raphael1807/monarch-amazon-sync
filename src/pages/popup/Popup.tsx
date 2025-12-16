import useStorage from '@root/src/shared/hooks/useStorage';
import Options from './Options';
import Main from './Main';
import ManualBackfill from './ManualBackfill';
import Onboarding from './components/Onboarding';
import { Navbar } from 'flowbite-react';
import appStorage, { Page, AuthStatus } from '@root/src/shared/storages/appStorage';

const Popup = () => {
  const storage = useStorage(appStorage);

  // Show onboarding if not completed and not both connected
  const showOnboarding =
    !storage.onboardingComplete &&
    (storage.amazonStatus !== AuthStatus.Success || storage.monarchStatus !== AuthStatus.Success);

  const handleOnboardingComplete = async () => {
    await appStorage.patch({ onboardingComplete: true, page: Page.Default });
  };

  if (showOnboarding) {
    return (
      <div className="min-w-[400px] min-h-[500px]">
        <Onboarding
          amazonStatus={storage.amazonStatus}
          monarchStatus={storage.monarchStatus}
          onComplete={handleOnboardingComplete}
        />
      </div>
    );
  }

  let page;
  if (storage.page === Page.Options) {
    page = <Options />;
  } else if (storage.page === Page.ManualBackfill) {
    page = <ManualBackfill />;
  } else {
    page = <Main />;
  }

  return (
    <div className="flex flex-col min-w-[400px]">
      <Navbar rounded fluid className="py-1 bg-gradient-to-r from-purple-600 to-blue-600">
        <Navbar.Brand>
          <img src="/icon-128.png" className="mr-2 h-8" alt="logo" />
          <span className="self-center whitespace-nowrap text-base font-bold text-white">Monarch / Amazon Sync</span>
        </Navbar.Brand>
        <Navbar.Toggle />
        <Navbar.Collapse>
          <Navbar.Link
            active={storage.page == Page.Default}
            onClick={() => {
              appStorage.patch({ page: Page.Default });
            }}
            className="cursor-pointer">
            Home
          </Navbar.Link>
          <Navbar.Link
            active={storage.page == Page.ManualBackfill}
            onClick={() => {
              appStorage.patch({ page: Page.ManualBackfill });
            }}
            className="cursor-pointer">
            Sync
          </Navbar.Link>
          <Navbar.Link
            active={storage.page == Page.Options}
            onClick={() => {
              appStorage.patch({ page: Page.Options });
            }}
            className="cursor-pointer">
            Settings
          </Navbar.Link>
        </Navbar.Collapse>
      </Navbar>
      {page}
    </div>
  );
};

export default Popup;
