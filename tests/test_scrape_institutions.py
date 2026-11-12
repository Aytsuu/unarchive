"""Unit tests for CHED directory parsing without accessing the network."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "scrape-institutions.py"
spec = importlib.util.spec_from_file_location("scrape_institutions", SCRIPT)
scraper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scraper)


class CatalogParserTests(unittest.TestCase):
    def test_extracts_only_names_and_codes(self):
        page = scraper.InstitutionParser()
        page.feed("""<h2>2 Records Found</h2><table><tbody>
          <tr><td><span>College &amp; University</span><span>NEW</span></td><td>private@example.com</td></tr>
          <tr><td><span>Another Campus</span><span>123</span></td><td>ignored</td></tr>
        </tbody></table>""")
        self.assertEqual(page.count(), 2)
        self.assertEqual(page.records, [("College & University", "NEW"), ("Another Campus", "123")])

    def test_missing_code_fails(self):
        page = scraper.InstitutionParser()
        with self.assertRaises(ValueError):
            page.feed("<tbody><tr><td><span>Missing code</span></td></tr></tbody>")

    def test_extracts_only_regional_links(self):
        page = scraper.RegionParser()
        page.feed('<a href="https://heida.ched.gov.ph/hei-directory/13"><h3>National Capital Region</h3></a><a href="https://example.com/13"><h3>Other</h3></a>')
        self.assertEqual(page.regions, [("13", "National Capital Region")])


if __name__ == "__main__":
    unittest.main()
